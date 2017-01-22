/*
Tool gets PandocJSON via stdin
Splits it at 1st level headlines into chapter-sized Pandoc-JSONs
Writes these Pandoc-JSONs to htmls

TODO:
- proper index page
- proper error handling

MAYBE:
- wrap the pandocJSON and the Pandoc-JSONs in an object which allows
  a cleaner passing(flow).of(conversions)?
-

*/
var stdin  = require('get-stdin'),
	pandoc = require('pandoc-filter'),
	child_process = require('child_process'),
	underscore = require('underscore'),
	getSplitpoints, //function
	splitPandocJSONFull, //function
	findLinks, //function
	findTargetIndex, //function
	createDocumentFilename, //function
	addNavAdditionalMeta,//function
	mergeMetadataToDoc;//function


stdin().then(function(stringJSON){
	console.log("gotstdin");
	var pandocJSONFull =  JSON.parse(stringJSON);

	var splits = getSplitpoints(pandocJSONFull); //helper to generate markers of where to split the document

	var documentsArray = splitPandocJSONFull(pandocJSONFull,splits); //Splits input document along splits in an array of Pandoc-JSONs.

	var newDocs = findLinks(documentsArray); //returns array of Pandoc-JSONs with rewritten links and a string for filename.

	var newDocsWithMeta = addNavAdditionalMeta(newDocs);
	//TODO: naming. New Docs could be linkedDocs or so.
	//var newDocsMetaWritten = addNavMeta(newDocs);

	//new docs: array[n].doc array[n].doc array[n]filename
	newDocsWithMeta.forEach(function(element, index, array){
		var process = "pandoc";
		var format = "html";
		var filename = element.additionalMeta.filename;
		if (filename.length === 0){
			filename = "filename"+index;
		}


		//TODO: pandoc overwrites previously set arguments with later ones (at least -o notwrite.html - writethis.html). So one could pass user arguments, since I could overwrite them if need
		//I can find the current directory of the script using __dirname which I could use for finding standard-templates and passing them to pandoc!

		var pandocArguments = ["--from json","-o",filename, " --toc", "--standalone" , "--template=newhtmltemp.html"];
		var pandocify = JSON.stringify(element.doc);
		console.log(pandocArguments.join(" "));
		var whathappend = child_process.execSync('pandoc'+' '+pandocArguments.join(" "),{input:pandocify});
		console.log(whathappend);
	});

	//write Index

	child_process.execSync('pandoc --from json -o index.html --standalone --template=indexhtmltemp.html',{input:JSON.stringify(newDocsWithMeta[0].doc)});

	//also, one index page:
	//indexPage = generateIndexPage(newDocsWithMeta);
	//child_process.execSync('pandoc')

}).catch(function(reason){
	console.error(reason);
});

getSplitpoints = function(pandocJSONFull){
	//DOES: Finds chapter headlines and their indicies
	//GETS: pandoc JSON
	//RETURNS: an array of objects:
	// [
	// {mainindex ← the index of the headline in the pandoc JSON BLOCK array
	//  title ← the headline, stripped of non-word characters},
	//…]

	var splitPoints = [];
//array with objects {start:#, end#} for saving the node with the headline in the first, the node before the next headline in the second.
	pandocJSONFull.blocks.forEach(function(element, index, array){
		if (element.t === "Header" && element.c[0] == 1){//headline first order aka chapter
			splitPoints.push({
				"mainindex":index,
				"title":pandoc. //NOTE: Do I ever need th title? For the filenames and links, the title/filename is generated in the "findLinks" function
					stringify(element.c). //stringify makes a part of the tree to a simple string with no formatting
					replace(/\W/g, '') 	//Strips all non-word characters
								//TODO: what about öä etc.? "ae äé".replace(/\W/,"") strips "ä" but not "é"
			});
		}
	});

	//TODO: Since there always should be a first page without chapter content as index page, move this to the splitPandocJSONFull function, since there the copying of the metadata etc. happens, which is needed (an empty blocks still can get metadata); first page would always be index and we would most likely not generate stupid filenames from paragraph starts anymore in this case.
	if(splitPoints[0].mainindex>0){ //text starts not with a headline. Add fake splitpoint, so that begin will be included.
		splitPoints.unshift({mainindex:0,title:""});
	}
	return splitPoints;
};

splitPandocJSONFull = function(pandocJSONFull, splitPoints){
	//DOES: Splits the full PandocJSON in an array of chapter length PandocJSON Objects
	//GETS:
	//  pandocJSONFull: a PandocJSON of the full document
	//  splitPoints: an array  ob ojjects, each like
	// {mainindex ← the index of the headline in the pandoc JSON BLOCK array
	//  title ← the headline of the chapter, stripped of non-word characters}
	//
	//RETURNS: Array with Pandoc-JSONs, each a chapter of the original document
	var chapterArray = [];

	//rewrite as Array.map
	splitPoints.forEach(function(element, index, array){
		var startPoint=null,
			endPoint=null,
			chapter ={},
			chapterBlocks =[];

		startPoint = element.mainindex;

		if(index === array.length-1){ //last iteration
			endPoint = pandocJSONFull.blocks.length;//end with the last main Document element. NOT length-1 since the last node should be included in contrast to the next headline!
		} else{//all other iterations
			endPoint = array[index+1].mainindex;//end before next headline
		}

		//get the blocks of a chapter from the pandocJSON
		//NOTE: Array.slice does copy contained objects by reference. This is o.k. since we don’t want to have the same content twice in different documents.
		//REMEMBER: Array.slice copies up to, but not including, endPoint!
		chapterBlocks = pandocJSONFull.blocks.slice(startPoint, endPoint);

		//create a synthetic pandoc JSON object from the
		chapter =
		{
			"meta": JSON.parse(JSON.stringify(pandocJSONFull.meta)), //sorta dirty trick to deep copy function-less objects: http://stackoverflow.com/a/122704/263398
			"blocks": chapterBlocks,
			"pandoc-api-version":JSON.parse(JSON.stringify(pandocJSONFull["pandoc-api-version"]))
		};

		chapterArray.push(chapter);
	});

	return chapterArray;
};

findLinks = function (documentsArray){ //finds internal links
	//DOES: rewrites all links in a pandocJSON which has internal links to external links if they link to another chapter.
	//GETS: array with several pandocJSON documents.
	//RETURNS: array with pandocJSON documents with rewritten links.

	var rewrittenLinksArray = [];

	documentsArray.forEach(function(origDocument, index, array){
		rewrittenLinksArray[index]={
			additionalMeta:{},
			doc:null
		};
		rewrittenLinksArray[index].additionalMeta.filename = createDocumentFilename(documentsArray[index]);
		rewrittenLinksArray[index].additionalMeta.naturalname = createDocumentNaturalName(documentsArray[index]);

		rewrittenLinksArray[index].doc = pandoc.walk(
				origDocument,
				function(type,value,format,meta){
					//value[2][0] is the link target string
					if (type === "Link" && value[2][0].indexOf("#") === 0){// === sourceLinkId.slice(1)){
						var targetIndex = findTargetIndex(documentsArray,value[2][0]);

						if(typeof targetIndex !== "number"){
								return undefined; //no target found
						} else if (targetIndex === index) {
							return undefined; //internal link can stay. Target is in the same document
						} else {
							var filename = createDocumentFilename(documentsArray[targetIndex]);
							var newValue = value;

							//value[2][0] being the internal link,  something like #foobar
							newValue[2][0] = filename+value[2][0];//creates link to  OTHER document);
							console.log(newValue);
							return {t:'Link',c:newValue};
						}
					}//endif
				},"html",origDocument.meta);//find links
	});//end foreach
	return rewrittenLinksArray;
};//endfunction



findTargetIndex = function(documentsArray,sourceLinkId){ //
	// GETS: documents array and sourceLinkId,
	// returns the block[index] of the document with the link target
	var targetDocumentIndex = null;

	documentsArray.forEach(function(element, index, array){
		pandoc.walk(
			element,
			function(type,value,format,meta){
				if (type === "Header" &&  value[1][0] === sourceLinkId.slice(1)){
					targetDocumentIndex = index;
					}//endif
					return undefined;
			},"html", element.meta);//end walk find targets
	});
	return 	targetDocumentIndex;
};

addNavAdditionalMeta = function(documentsArray){
	//TODO: Maybe this should just return the metadata for a given document?

	//TODO: if first does start with headline, create a 0-th doc as index file.

	documentsArray.forEach(function(document,index,array){

		var additionalMeta =  {};

		if(array[index+1]){ //is there a next?
			documentsArray[index].additionalMeta.next = array[index+1].additionalMeta.filename;
		}
		if(array[index-1]){ //is there a before?
			documentsArray[index].additionalMeta.before = array[index-1].additionalMeta.filename;
		}

		//following feels meh.
		documentsArray[index].additionalMeta.allFilenames = documentsArray.map(
			function(innerdocument,innerindex,innerarray){
				var filename = innerdocument.additionalMeta.filename;
				var naturalname = innerdocument.additionalMeta.naturalname;
				var isMe = ((innerdocument.additionalMeta.filename === document.additionalMeta.filename)? true:false);
				//if the document I currently collecting for the filename collection is identical to the current docuement, set to true. This way, the list "knows" if a filename/name in the collection concerns the document it is saved on. Useful to e.g. if you want to generate a navigation bar and mark the "you are here" link.
			return {
				"filename":filename,
				"name":naturalname,
				"isMe":isMe
				};
			}
		);

		//merge the created additionalMetadata into the document object.
		console.log(documentsArray[index].additionalMeta);
		documentsArray[index].doc = mergeMetadataToDoc(documentsArray[index].doc,documentsArray[index].additionalMeta);
	});

	return documentsArray;
 };


// -----------------------------------------------------------------------
// HELPERS – These Helpers that don’t spit out
// a transformed list of documents but are
// called from the functions which do so.
// ------------------------------------------------------------------------

createDocumentFilename = function(singleDocumentArray){
	//DOES: Create a chapter-title-based filename for a chapter
	//GETS: a pandocJSON
	//RETURNS: a filename for the document made of the Pandoc-JSON.
	var namestring;
	if(singleDocumentArray.blocks[0].t === "Header"){ //if first block in array is a headline (should be the case)
		namestring = singleDocumentArray.blocks[0].c[1][0];   // (c)ontent of the headline block (1)identifier array (0) identifier
		//namestring = pandoc.stringify(singleDocumentArray.blocks[0].c).replace(/\W/g, '');//http://stackoverflow.com/questions/9364400/remove-not-alphanumeric-characters-from-string-having-trouble-with-the-char
	}else{
		namestring = pandoc.stringify(singleDocumentArray).slice(0,10).replace(/\W/g, ''); //this is rather inefficient to walk all the subtree (pandoc.stringify) to create a filename
	}
	namestring = namestring+".html";
	return namestring;
};

createDocumentNaturalName = function(singleDocumentArray){
	//DOES: give a human readable name; if the first block is a headline, it is its stringified value.
	//GETS: a pandocJSON
	//RETURNS: a string

	var namestring;

	if(singleDocumentArray.blocks[0].t === "Header"){
		namestring = pandoc.stringify(singleDocumentArray.blocks[0]);
	}else{
		namestring = pandoc.stringify(singleDocumentArray.blocks[0]).slice(0,10); //since a paragraph could be rather long, we take the first 10 chars
	}

	return namestring;
};

mergeMetadataToDoc = function(pandocJSON, metadataJSON){
	// DOES: Merge JSON-defined metadata in adocument (which is returned)
	// GETS: a pandocJSON and a JSON with metadata
	// RETURNS: a pandocJSON
	// ERRORS/LOGs:
	// DEPENDS ON: pandoc binary, underscore (?)

	//Originally, I wanted to use json2yaml. Turns out, YAML is a superset of JSON. Pandoc needs the YAML --- end and beginning in the string, though.
	var pandocifiedMetadataJSON = "\n---\n"+JSON.stringify(metadataJSON)+"\n---"; //very careful with the start and end indocators; getting them wring causes them to be parsed as text and the metadatastuff fails.

	var metadataPandocBuffer = child_process.execSync('pandoc -t json',{input:pandocifiedMetadataJSON}); //could benefit from structor; I only want the "meta" block of it.
	var metadataPandocJSON = JSON.parse(metadataPandocBuffer.toString()); //The output comes as a sort of array of numbers. toString makes it a JSON-like string, which is then parsed.

	//merge the tempoary metadata-pandoc-JSON with the document’s metadata.
	pandocJSON.meta = underscore.extend(pandocJSON.meta,metadataPandocJSON.meta); //TODO: could be replaced by a copy of the used underscore function

	return pandocJSON;
};

/*
Problems: Text always starts with first headline not with any Text.
*/
var stdin  = require('get-stdin'),
	pandoc = require('pandoc-filter'),
	child_process = require('child_process'),
	getSplitpoints, //function
	splitPandocJSONFull, //function
	findLinks,
	findTargetIndex,
	createDocumentFilename,
	callWalker,
	titleSeperator = " – "; //seperates generalTitle from part Title


stdin().then(function(stringJSON){
	console.log("gotstdin");
	var pandocJSONFull =  JSON.parse(stringJSON);

	var splits = getSplitpoints(pandocJSONFull); //helper to generate markers of where to split the document

	var documentsArray = splitPandocJSONFull(pandocJSONFull,splits); //Splits input document along splits in an array of Pandoc-JSONs.

	var newDocs = findLinks(documentsArray); //returns array of Pandoc-JSONs with rewritten links and a string for filename.

	//console.log(JSON.stringify(newDocs[1]));
	/*
	try 1doc, 2doc as input for pandoc with
	pandoc -f json 1doc.json 1doc.html

	*/


	//new docs: array[n].doc array[n].doc array[n]filename
	newDocs.forEach(function(element, index, array){
		var process = "pandoc";
		var format = "html";
		var filename = element.filename;
		if (filename.length === 0){
			filename = "filename"+index;
		}
		var pandocArguments = ["--from json",("-o "+filename+".html")];
		var pandocify = JSON.stringify(element.doc);
		var whathappend = child_process.execSync('pandoc'+' '+pandocArguments.join(" "),{input:pandocify});
		console.log(whathappend);
	});

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
		chapter={
			"meta": JSON.parse(JSON.stringify(pandocJSONFull.meta)), //sorta dirty trick to deep copy function-less objects: http://stackoverflow.com/a/122704/263398
			"blocks": chapterBlocks,
			"pandoc-api-version":JSON.parse(JSON.stringify(pandocJSONFull["pandoc-api-version"]))
		};

		chapterArray.push(chapter); //TODO
	});

	return chapterArray;
};

findLinks = function (documentsArray){ //finds internal links
	//DOES: rewrites all links in a pandocJSON which has internal links to external links if they link to another chapter.
	//GETS: array with pandocJSON documents.
	//RETURNS: array with pandocJSON documents with rewritten links.

	var rewrittenLinksArray = [];

	documentsArray.forEach(function(origDocument, index, array){
		rewrittenLinksArray[index]={};
		rewrittenLinksArray[index].filename = createDocumentFilename(documentsArray[index]);
		console.log("origDocument:\n \n ",origDocument,"|", index);
		rewrittenLinksArray[index].doc = pandoc.walk(
				origDocument,
				function(type,value,format,meta){
					//value[2][0] is the link target string
					if (type === "Link" && value[2][0].indexOf("#") === 0){// === sourceLinkId.slice(1)){
						var targetIndex = findTargetIndex(documentsArray,value[2][0]);

						if(typeof targetIndex !== "number"){
								return undefined; //no target found
						} else if (targetIndex === index) {
							return undefined;//internal link can stay. Target is in the same document
						} else {
							var filename = createDocumentFilename(documentsArray[targetIndex]);
							var newValue = value;
							//console.log("[",value[0],",",value[1],"]");

							//return pandoc.Link(value[0],value[1]);

							newValue[2][0] = filename+"."+format+value[2][0];//creates link to  OTHER document);
							console.log(newValue);
							return {t:'Link',c:newValue};
						}
					}//endif
				},"html",origDocument.meta);//find links
	});//end foreach
	return rewrittenLinksArray;
};//endfunction

createDocumentFilename = function(singleDocumentArray){
	//GETS: a pandocJSON
	//RETURNS: a filename for the document made of the Pandoc-JSON.
	var namestring;
	if(singleDocumentArray.blocks[0].t === "Header"){ //if first block in array is a headline (should be the case)
		namestring = singleDocumentArray.blocks[0].c[1][0]   // (c)ontent of the headline block (1)identifier array (0) identifier
		//namestring = pandoc.stringify(singleDocumentArray.blocks[0].c).replace(/\W/g, '');//http://stackoverflow.com/questions/9364400/remove-not-alphanumeric-characters-from-string-having-trouble-with-the-char
	}else{
		namestring = pandoc.stringify(singleDocumentArray).slice(0,10).replace(/\W/g, ''); //this is rather inefficient to walk all the subtree (pandoc.stringify) to create a filename
	}

	return namestring;
};

//TODO check for using the pandoc generated identfiers for filenames too
findTargetIndex = function(documentsArray,sourceLinkId){ //
	// gets documents array and sourceLinkId,
	// returns the index of the document with the link target
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

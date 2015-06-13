/*
Problems: Text always starts with first headline not with any Text.
*/
var pandoc = require('pandoc-filter'),
	stdin  = require('get-stdin'),
	child_process = require('child_process'),
	getSplitpoints, //function
	splitPandocJSONFull,
	findLinks,
	findTargetIndex,
	createDocumentFilename,
	callWalker,
	titleSeperator = " – "; //seperates generalTitle from part Title


stdin(function(stringJSON){
	var pandocJSONFull =  JSON.parse(stringJSON);
	var splits = getSplitpoints(pandocJSONFull);

	var documentsArray = splitPandocJSONFull(pandocJSONFull,splits);

	var newDocs = findLinks(documentsArray);

	//console.log(JSON.stringify(newDocs[1]));
	/*
	try 1doc, 2doc as input for pandoc with
	pandoc -f json 1doc.json 1doc.html

	*/


	//new docs: array[n].doc array[n].doc array[n]filename
	newDocs.forEach(function(element, index, array){
		var process = "pandoc"
		var format = "html"
		var filename = element.filename;
		if (filename.length === 0){filename = "filename"+index}
		var arguments = ["--from json",("-o "+filename+".html")];
		var pandocify = JSON.stringify(element.doc);
		var whathappend = child_process.execSync('pandoc'+' '+arguments.join(" "),{input:pandocify});
		console.log(whathappend);
	});

});

getSplitpoints = function(pandocJSONFull){
	var splitPoints = [];
//array with objects {start:#, end#} for saving the node with the headline in the first, the node before the next headline in the second.
	pandocJSONFull[1].forEach(function(element, index, array){
		if (element.t === "Header" && element.c[0] == 1){//headline first order
			splitPoints.push({"mainindex":index,"title":pandoc.stringify(element.c).replace(/\W/g, '')});
		}
	});

	if(splitPoints[0].mainindex>0){ //text starts not with a headline. Add fake splitpoint, so that begin will be included.
		splitPoints.unshift({mainindex:0,title:""});
	}
	return splitPoints;
};

splitPandocJSONFull = function(pandocJSONFull, splitPoints){
	//returns: Array with Pandoc-JSONs
	var documentsArray = []


	splitPoints.forEach(function(element, index, array){
		var startPoint,
			endPoint;


		startPoint = element.mainindex;


		if(index === array.length-1){ //last iteration
			endPoint = pandocJSONFull[1].length;//end with the last main Document element. NOT length-1 since the last node should be included in contrast to the next headline!
		} else{//all other iterations
			endPoint = array[index+1].mainindex;//end before next headline
		}


		var singleDocumentArray = pandocJSONFull[1].slice(startPoint, endPoint);
		//NOTE: Array.slice does copy contained objects by reference. This is o.k. since we don’t want to have the same content twice in different documents.
		//REMEMBER: Array.slice copies up to, but not including, endPoint!

		var metadata = JSON.parse(JSON.stringify(pandocJSONFull[0])); //sorta dirty trick to deep copy function-less objects: http://stackoverflow.com/a/122704/263398
		documentsArray.push([metadata,singleDocumentArray]);
	});

	return documentsArray;
};

findLinks = function (documentsArray){ //finds internal links
	var rewrittenLinksArray = [];

	documentsArray.forEach(function(element, index, array){
		rewrittenLinksArray[index]={};
		rewrittenLinksArray[index].filename = createDocumentFilename(documentsArray[index]);
		rewrittenLinksArray[index].doc = pandoc.walk(
				element,
				function(type,value,format,meta){
					//console.log(type,value);

					if (type == "Link" && value[1][0].indexOf("#") === 0){// === sourceLinkId.slice(1)){

						var targetIndex = findTargetIndex(documentsArray,value[1][0]);

						if(typeof targetIndex !== "number"){
								return undefined; //no target found
						} else if (targetIndex === index) {
							return undefined;//internal link can stay. Target is in the same document
						} else {
							var filename = createDocumentFilename(documentsArray[targetIndex]);
							var newValue = value;
							//console.log("[",value[0],",",value[1],"]");

							//return pandoc.Link(value[0],value[1]);

							newValue[1][0] = filename+"."+format+value[1][0];//creates link to  OTHER document);
							console.log(newValue)
							return {t:'Link',c:newValue};
						}
					};//endif
				},"html",element[0].unMeta);//find linksunMeta
	});//end foreach
	return rewrittenLinksArray;
};//endfunction

createDocumentFilename = function(singleDocumentArray){
	var namestring;
	if(singleDocumentArray[1][0].t === "Header"){
		namestring = pandoc.stringify(singleDocumentArray[1][0].c).replace(/\W/g, '');//http://stackoverflow.com/questions/9364400/remove-not-alphanumeric-characters-from-string-having-trouble-with-the-char
	}else{
		namestring = pandoc.stringify(singleDocumentArray).slice(0,10).replace(/\W/g, ''); //this is rather inefficient to walk all the subtree (pandoc.stringify) to create a filename
	}

	return namestring;
};


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
			},"html", element[0].unMeta);//end walk find targets
	});
	return 	targetDocumentIndex;
};






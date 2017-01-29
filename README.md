# Split Markdown Documents Filter#

Splits markdown documents into single files. Currently, it converts only to html. May be a bit buggy, so don’t run it on your only, non-backuped copy of your thesis, or the like (even though it is not programmed to touch the target file at all).

## What it does: ##
It splits on every main headline (`= Headline =`)

It rewrites internal links (the ones with "#") which now point to other files by prepending the target file name and keeping the #-Part (so `#jumpthere` may become `otherfile.html#jumphere`)

##Usage ##

`pandoc -t json myLongMDFile.md | node writeSplitPandocJSON.js`
Results in several (not-standalone) HTML files named like the headlines they start with.

### Parameters:
* `--indextemplate`: A file path to a pandoc template for html which will be used for the index.html page which is generated. Defaults to a template in this repo.
* `--chaptertemplate`: A file path to a pandoc template for html which will be used for the chapters pages generated. Defaults to a template in this repo.
*  `--defaultpandoc`: A string, enclosed by "". Will be passed to pandoc when both index or chapter will be generated.
* `--indexpandoc`: A string, enclosed by "". Will be passed to pandoc when it is called to generate the index.html.
* `--chapterpandoc`: A string, enclosed by "". Will be passed to pandoc when it is called to generate the html files for the chapters.


## Customize Templates

The templates get the following *additional* metadata, to be used like the usual values pandoc provides:

* **chapterfilename**: The name of the current chapter
* **chapternaturalname**: The name¹ of the current chapter
* **next**: object for infos about the next chapter
    * **naturalname**: the name¹ of the next chapter
    * **chapterfilename**: the filename of the next chapter
* **before**: object for infos about the chapter before
    * **chapterfilename**: the name¹ of the chapter before
    * **chapterfilename**: the filename of the chapter before
<!-- TODO: continue; allfilenames should be renamed allChapters first-->
* **allChapters**: an array, meant for constructing an simple menu. For each chapter, it contains:
    * **chapterfilename**: the name of the chapter
    * **chapterfilename**: the filename  the chapter
    * **isMe**: boolean. True if the current file is the same as the file this list entry is concerned with. Meant to facilitate things like filtering this entry out, disabling it’s link or highlighting it

¹ *usually the content of the first-level-headline it starts with*


## Requirements ##
* Pandoc
* Node
* As well as:
	* [pandoc-filter](https://github.com/mvhenderson/pandoc-filter-node)
	* [get-stdin](https://github.com/sindresorhus/get-stdin)
    * [cli](https://github.com/node-js-libs/cli)

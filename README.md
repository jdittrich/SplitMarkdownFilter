# Split Markdown Documents Filter#

Splits markdown documents into single files. Currently it converts only to html, but other formats are easily integrated as well. May be a bit buggy, so don’t run it on your only, non-backuped copy of your thesis, or the like (even though it is not programmed to touch the target file at all).

## What it does: ##
It splits on every main headline (\= Headline \=)

It rewrites internal links (the ones with "#") which now point to other files by porepending the target file name and keeping the #-Part (so `#jumpthere` may become `otherfile.html#jumphere`)

##Usage ##

`pandoc -t json myLongMDFile.md | node writeSplitPandocJSON.js`
Results in several (not-standalone) HTML files named like the headlines they start with.

## Requirements ##
* Pandoc
* Node (sort-of currently) 
* As well as: 
	* [pandoc-filter](https://github.com/mvhenderson/pandoc-filter-node)
	* [get-stdin](https://github.com/sindresorhus/get-stdin)




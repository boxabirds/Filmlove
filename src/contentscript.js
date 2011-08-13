/*
 * Copyright (c) 2010 The Chromium Authors. All rights reserved.  Use of this
 * source code is governed by a BSD-style license that can be found in the
 * LICENSE file.
 */

// OPTIONS - to be put into options panel later
var HIDE_RATED_ITEMS = true;
var HIDE_ADS = false; 

// Page-specific divs
var FILM_LISTING_DIV_CLASS = 'film_listing';
var FILM_COUNT_DIV_CLASS = 'box_title';

// This is what the div looks like:
// <div id="ajaxItemRow141576" class="film_listing sd open fl_detail ">
//  <div class="fl_detail_image_area  ">
//	... 
// </div> 
// <div class="fl_detail_info">
// <h2><a href="http://www.lovefilm.com/film/The-Lives-of-Others/86184/" title="The Lives of Others">The Lives of Others</a>
//      <span class="release_decade">(2006)</span>
//  </h2>
// ...
// </div>

var gMasterCloseBoxElement;
var gHiddenCountSpan;

// our master 'x' node that copies of are inserted into the DOM as 
// it finds them, by calling e.insertBefore(c,e.childNodes[0]);
// typically it's in a 'film_listing' element, typically structured like this:
// <div id=​"ajaxItemRow146582" class=​"film_listing sd open fl_detail ">​ ... 
function getNewCloseBoxElement(parentDiv) {
	// if it's not set up the first time, create it
	// 	<div style="position:relative;left:590px;top:15px;"><img src="http://www.biocentury.com/archives/Images/icon_delete.gif"></div>
	if(gMasterCloseBoxElement == undefined) {
		var divContainer = document.createElement("div");
		var style = document.createAttribute("class");
		style.nodeValue = "go-away";
		divContainer.setAttributeNode(style);
		var img = document.createElement("img");	
		var src = document.createAttribute("src");
	
		src.nodeValue = chrome.extension.getURL("images/icon_delete.gif");// "http://www.biocentury.com/archives/Images/icon_delete.gif";
		img.setAttributeNode(src);
		divContainer.appendChild(img);
		gMasterCloseBoxElement = divContainer;
	}
	return gMasterCloseBoxElement.cloneNode(true);
}

function handleCloseBoxClick() {
	var parent = this.parentNode;
	// it's child 4 now we inserted our close box
	var title = parent.childNodes[4].childNodes[1].childNodes[0].innerText;
	console.log( "blatted " + title );
	
	chrome.extension.sendRequest({method: "addToBlacklist", film:title}, function(response) {
		parent.style.display = 'none';
	});
}

function clearBlacklist() {
	chrome.extension.sendRequest({method: "clearBlacklist"}, function(response) {
		// as this is a click handler for a link apparently 'this' is DOMWindow which is a bit
		// useless. So we store the span ref 'globally' (page-level). 
		gHiddenCountSpan.innerHTML = "Only rated items will be hidden on next page refresh.";
	});
}


// our page has loaded, so 
// get our extension local storage with our blacklisted films in it
//http://stackoverflow.com/questions/3937000/chrome-extension-accessing-localstorage-in-content-script
chrome.extension.sendRequest({method: "getBlacklist"}, function(response) {
	var filmElements = document.getElementsByClassName(FILM_LISTING_DIV_CLASS);
	var numHidden = 0;
	var numRated = 0;
	for( var i = 0; i < filmElements.length; i++ ) {
		// TODO we could use an XPATH so the order of the nodes wouldn't matter
		// but do this later once we've found it
		var film = filmElements[i];
		var filmName = film.childNodes[3].childNodes[1].childNodes[0].innerText;
		var ratingNode = film.childNodes[3].childNodes[3].childNodes[1].childNodes[0].innerText;
		
		if( response.blacklist[filmName] ) {
			console.log("gotcha! film: " + filmName + "blacklisted, so removing it from the page");
			filmElements[i].style.display = 'none';	
			numHidden++;

		// we've given it a rating so hide it as well
		} else if( HIDE_RATED_ITEMS && (ratingNode != undefined) ) {
			console.log("film: " + filmName + "has already been rated so removing it from the page");
			filmElements[i].style.display = 'none';	
			numHidden++;
			numRated++;
			
		// it's a film we might actually want to hide that's not hidden, so add the go-away box
		} else {
			var newCloseBox = getNewCloseBoxElement();
			film.insertBefore(newCloseBox,film.childNodes[0]);
			newCloseBox.onclick = handleCloseBoxClick;
		}
	}
	
	// now put a note at the top of the search results
	var summary = document.getElementsByClassName(FILM_COUNT_DIV_CLASS);
	var countNode = summary[0].childNodes[1];
	
	// insert a new span at the end of the text currently saying "4,923 titles" that says "5 titles on this page hidden"
	gHiddenCountSpan = document.createElement("span");
	var style = document.createAttribute("class");
	style.nodeValue = "hidden-count";
	gHiddenCountSpan.setAttributeNode(style);
	gHiddenCountSpan.innerText = "| " + numHidden + " titles hidden by Filmlove";
	
	// we have some that have been manually blacklisted
	if( numHidden > numRated ) {
		var showAllLink = document.createElement("a");
		showAllLink.innerText = "Clear blacklist";
		showAllLink.onclick = clearBlacklist;
		gHiddenCountSpan.appendChild(showAllLink);
	}

	countNode.appendChild(gHiddenCountSpan);
});

---
layout: post
title: "KnockoutJS demo using Google Books API"
description: "A quick and dirty demo to show off a very simple example of what you can do with some knockoutjs code and an AJAX call.  I use the google books API to provide a simple search form."
categories : 
tags: [knockoutjs, ajax, googleapi]
---
{% include JB/setup %}

Knockout.js
=========

###Introduction
A quick and dirty demo to show off a very simple example of what you can do with some knockoutjs code and an AJAX call.  I use the google books API to provide a simple search form.


###Show me the Code

JSFiddle:
<iframe width="100%" height="400" src="http://jsfiddle.net/SecretDeveloper/d9xfP/embedded/" frameborder="0"> </iframe>

Check out the [jsfiddle](http://jsfiddle.net/SecretDeveloper/d9xfP/embedded/result/)

I also use the [underscore](http://underscorejs.org/) library to work with the observableArray but that is not really a requirement.  I just like it.

###So whats happening?
We start off by creating a simple html page that contains a text box, a button and a results list. In our javascript file we create a ViewModel object (function) that contains properties that match our html form. It has a field for searchInput, a function to handle searches etc.  In our document ready function we apply this ViewModel to our html using `ko.applyBindings(vm);`.  When we do this knockoutjs takes our html and resolves all the `data-bind=""` attributes we have added to elements and resolves them to fields on our ViewModel.  This is called Model Binding and it is a powerful tool that allows us to have a single ViewModel property displayed in several places on a page, with each kept in sync to any changes.  If the field we are binding to is a `ko.observable` then any changes made to its value will immediately show wherever it is bound.

We also use a `ko.observableArray` to hold our search results.  When we initiate a search we make an AJAX call to the appropriate url and then parse the results.  You can see the result structure we receive back by running `curl -i https://www.googleapis.com/books/v1/volumes?q=potter` (where 'potter' is what you want to search for).  Once receive the result we loop over the returned items and create a new resultItem to contain the information we want.  These items are then added to our array, `self.items.push(resultI);` which thanks to knockoutjs gets rendered to our results div immediately.  You can see that knockoutjs can iterate over collections by using the `foreach:items` databinding. 

###Whats the big deal?

Well this particular demo is about as easy as it gets, but even so it covers a few important topics:
* [Model View ViewModel](http://en.wikipedia.org/wiki/Model_View_ViewModel) pattern. 
* [Model Binding](http://knockoutjs.com/documentation/binding-context.html) as it applies to Knockout
* Working with [web API's](http://en.wikipedia.org/wiki/Web_API) using [JSON](http://en.wikipedia.org/wiki/JSON).
 
It shows what we can achieve with a few lines of code by building upon these powerful libraries.  KnockoutJS is taking care of binding our ViewModel to our html and also updates that html whenever we change an observable. jQuery is handling the AJAX request for us.






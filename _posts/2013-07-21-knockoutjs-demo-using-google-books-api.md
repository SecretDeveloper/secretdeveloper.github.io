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

###Whats the big deal?

Well this particular demo is about as easy as it gets, but even so it covers a few important topics:
* [Model View ViewModel](http://en.wikipedia.org/wiki/Model_View_ViewModel) pattern. 
* [Model Binding](http://knockoutjs.com/documentation/binding-context.html) as it applies to Knockout
* Working with [web API's](http://en.wikipedia.org/wiki/Web_API) using [JSON](http://en.wikipedia.org/wiki/JSON).
 
It shows what we can achieve with a few lines of code by building upon these powerful libraries.  KnockoutJS is taking care of binding our ViewModel to our html and also updates that html whenever we change an observable. jQuery is handling the AJAX request for us.






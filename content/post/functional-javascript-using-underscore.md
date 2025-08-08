+++
date = "2013-07-21T15:03:58+01:00"
title= "Functional javascript using underscore"
description= "Learning some functional programming techniques using the underscore library."
categories=["functional-programming", "javascript", "underscore"]
+++

## Functional javascript using underscore  

### Why?
A little while ago I picked up [Functional Javascript](http://www.amazon.com/gp/product/B00D624AQO/ref=as_li_ss_tl?ie=UTF8&camp=1789&creative=390957&creativeASIN=B00D624AQO&linkCode=as2&tag=secretdeveloper-20) by Michael Fogus.  I'm only part way through it and to be honest I should probably have waited until I finished it before starting this post but...

There is a central theme to this book which intrigued me, indeed its one of the main tenets of functional programming.  It can be summed up in this quote:
>"It is better to have 100 functions operate on one data structure than 10 functions on 10 data structures." - Alan Perlis

This is very different concept to what is normally seen in large enterprise level projects and applications.  I have to say that I have spent a large amount of time writing code to map one model to another and back again. Its not fun. This functional stuff might be on to something.

### What?
Well Michaels book uses the [underscore](http://underscorejs.org) library for all of his examples and its a really powerful tool.  I have started using it here and there on smaller projects and the more I use it the more I like it.

### How?
[Project Euler](http://http://projecteuler.net/) is probably the go-to set of problems when developers try to learn a new language or framework.  I don't see why I should be any different.  I have started a small project to play around with this and you can see it over on [github](https://github.com/SecretDeveloper/sdjs).

#### Problem 1

>If we list all the natural numbers below 10 that are multiples of 3 or 5, we get 3, 5, 6 and 9. The sum of these multiples is 23. Find the sum of all the multiples of 3 or 5 below 1000.

Can be solved with a few lines of code like the following:
```
    return _.reduce(_.range(0,1000), function(memo, number){  
    		if( number%3===0 || number%5==0) return memo+number;  
    		return memo;}  
    	);  
```

#### Testing
Unit testing javascript has come a long way in the last few years and I have added a simple QUnit test runner to the repository.  
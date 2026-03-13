+++
date = "2013-08-06T15:03:58+01:00"
title= "Data Models, functional composition and validation"
description= "Using function composition to validate data models in javascript."
categories= ["underscore","data-models","composition","validation"]
+++

While I am working my way through the [Functional Javascript](http://www.amazon.com/gp/product/B00D624AQO/ref=as_li_ss_tl?ie=UTF8&camp=1789&creative=390957&creativeASIN=B00D624AQO&linkCode=as2&tag=secretdeveloper-20) book I came across something that could be really useful, especially when dealing with AJAX requests.

#### Functional Composition
In a nutshell you start with simple functions that do a single job and then chain them up to perform some larger task.  In this example we want to validate that the json being returned from an AJAX call contains the properties we require.  To do that we start with the following function:

    function validator(message, fun){
        var f = function(){
            return fun.apply(fun, arguments);
        };
        f['message'] = message;
        return f;
    };

which takes a message string and a function as parameters and returns an object what can be called with an arbitrary number of arguments to perform a task.  The returned object has a 'message' property assigned also.

Next we need a 'driver' function:

    function checker(){  
        var validators = _.toArray(arguments);  
        return function(obj){  
            return _.reduce(validators, function(errs, check){  
                if(check(obj))  
                    return errs;  
                else  
                    return _.chain(errs).push(check.message).value();  
            }, []);  
        };  
    };  

that should be called with a list of validators as its arguments. It loads these into an array and returns a function which uses this array to validate the object 'obj'. It will loop over each of the validators in the array and checks to see if the obj object passes each of them.  If the check fails then it appends the validators 'message' to the list it will return. If all validators pass then the array returned will be empty.

#### Putting it all together
I can use my checker and validator functions to create a validation function like the following:

    function isValidResourceItem(){
        var validators = checker(
		
            validator('obj can not be nul',
			    function(obj){return !_.isNull(obj);}),
			
            validator('obj must contain title',
		        function(obj){return !_.isNull(obj.title);}),
			
            validator('obj must contain canonicalVolumeLink',
		        function(obj){return !_.isNull(obj.canonicalVolumeLink);}),
			
            validator('obj must contain description',
		        function(obj){return !_.isNull(obj.description);})
        );
        return validators;
    };

which will help to ensure the data was returned in a format I expect and cut down on those 'undefined' errors you would get without something like this.

#### Example
I reused an example from an earlier jsFiddle to test the idea out, I want to be sure the search results json object contains the properties I need to produce a results list. 

<iframe width="100%" height="300" src="http://jsfiddle.net/SecretDeveloper/8PqEG/5/embedded/" allowfullscreen="allowfullscreen" frameborder="0"> </iframe>

#### Whats the point?
Well I guess it shows an easy way to take pieces of functionality, place them into small reusable functions and build upon them into a pretty powerful set of tools.  
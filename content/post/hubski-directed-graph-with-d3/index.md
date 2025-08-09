+++
date = "2014-12-16T22:34:47Z"
title = "Directed Graph of hubski users created with D3"
description= "Using some scraped data."
categories= ["javascript","csharp","D3","graph"]
+++

Using some c# code to scrape hubski.com I was able to produce a pretty basic directed graph showing users follower connections.


[Source code on github](https://github.com/SecretDeveloper/SocialGraph)

[Demo version](../../projects/hubski-socialgraph/hubski_graph.html)

[Advanced Demo version](../../projects/hubski-socialgraph/hubski_graph_advanced.html)

[Hubski Social Graph](../../projects/hubski-socialgraph/hubski_graph.html)


I started off by scanning a users profile and recording various pieces of information such as:
- Age in days
- Number of followers
- Number of people followed
- Number of badges received.

I then looped over each of that users followers and recorded the same information,  and then their followers, and then their followers...  you get the idea.

I ended up thousands of accounts which was good but most of them only had 1 or 2 followers indicating a low level of social integration.  I filtered out most accounts with less than 25 followers (a few did make it in) in order to represent the core social group members.

I graphed the data using <a href="http://d3js.org/">D3</a> into a force directed graph that included all of the connections (follows) between each of the gathered members.  There is some gravity applied to the area which results in the larger (more followed) users being drawn towards the center while the smaller users encircle them, like satellites basking in the glow of a shining sun, or hornets buzzing around fresh manure.

It's a work in progress, search needs to be fixed...

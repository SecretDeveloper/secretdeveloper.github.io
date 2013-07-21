---
layout: page
title: '@secretdeveloper'
tagline: random writings
---
### What is this blog about?
This is a playground blog to store some posts written by a guy called Gary Kenneally.  You should follow me on [twitter under the handle @secretdeveloper](http://twitter.com/secretdeveloper), more  [here]({{BASE_PATH}}/pages/about) or on [linkedin](http://www.linkedin.com/profile/view?id=49530287&trk=tab_pro).  This blog contains static content generated from a [github repository](https://github.com/SecretDeveloper/secretdeveloper.github.io)


### Posts

<ul class="posts">
  {% for post in site.posts %}
    <li><span>{{ post.date | date_to_string }}</span> &raquo; 
		<a href="{{ BASE_PATH }}{{ post.url }}">{{ post.title }}</a>
	</li>
  {% endfor %}
</ul>






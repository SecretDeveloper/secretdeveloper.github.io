---
layout: page
title: posts by @secretdeveloper
tagline: 
---
## What is this blog about?
This is a playground blog to store some posts written by a guy called Gary Kenneally.  You should follow me on [twitter under the handle @secretdeveloper](http://twitter.com/secretdeveloper), more  [here]({{BASE_PATH}}/pages/about) or on [linkedin](http://www.linkedin.com/profile/view?id=49530287&trk=tab_pro).  He set this blog up to play with the following:
<ul>
  <li><span><a href="http://jekyllrb.com/">jekyll</a></span></li>
  <li><span><a href="http://www.ruby-lang.org/en/">ruby</a></span></li>
  <li><span><a href="http://rake.rubyforge.org/">rake</a></span></li> 
  <li><span><a href="http://twitter.github.io/bootstrap/">twitter bootstrap</a></span></li>
  <li><span><a href="http://jekyllbootstrap.com/">jekyll bootstrap</a></span></li>
  <li><span>and <a href="http://pages.github.com/">github pages</a></span></li>  
</ul> 
This blog contains static content generated from a [github repository](https://github.com/SecretDeveloper/secretdeveloper.github.io)

{% if site.posts.length < 1%}
## No Posts yet!
I'm still setting up.
{% endif %}

{% if site.posts.length > 0%}
## Posts

<ul class="posts">
  {% for post in site.posts %}
    <li><span>{{ post.date | date_to_string }}</span> &raquo; <a href="{{ BASE_PATH }}{{ post.url }}">{{ post.title }}</a></li>
  {% endfor %}
</ul>
{% endif %}





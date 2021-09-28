# Nodelab

[https://alicelab.herokuapp.com/index.html](https://alicelab.herokuapp.com/index.html)


-----

Client objects include:

- unique id: 128-bit via UUID library, server managed

- "room" path: a string to identify which world they are currently in

- shared: 
  	- pos, quat (head pose as MVP) 	
		- streamed continuously with each request for updates, e.g. 10fps
		- root(foot) position (or head height & orientation?)
	- user:
		- user-specific data that only rarely changes, including identification, style, etc., as determined by client
		- ident minimum: name (vetted for uniqueness by server?)
		- MVP: a unique RGB colour

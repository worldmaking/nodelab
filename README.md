# Nodelab

[https://alicelab.herokuapp.com/index.html](https://alicelab.herokuapp.com/index.html)

[https://alicelab.world/nodelab/index.html](https://alicelab.world/nodelab/index.html)



-----

Client objects include:

- unique id: should this be a hash derived from IP etc.? session id?    
  must be something genuinely unique, vetted by server during handshake

- world/room name/path: string to identify which world they are part of

- pose: 
	- streamed continuously with each request for updates, e.g. 10fps
	- head position & orientation, foot position (or, foot position, head height & orientation?)

- userdata:
	- user-specific data that only rarely changes, including identification, style, etc., as determined by client
	- ident minimum: name (vetted for uniqueness by server?)
	- style minimum: a unique colour
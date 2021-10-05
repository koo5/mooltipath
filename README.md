# mooltipath

## what is this?
* not this https://techwelkin.com/combine-multiple-internet-connections

* not this https://lartc.org/howto/lartc.rpdb.multiple-links.html
^ this is just load balancing

* not https://en.wikipedia.org/wiki/Linux_DM_Multipath

* probably not this https://www2.dmst.aueb.gr/dds/sw/dgsh/ (but it looks fun)

* not this https://www.techrepublic.com/article/how-to-use-multiplexing-to-speed-up-the-ssh/
* not this https://stackoverflow.com/questions/23255841/how-can-i-split-and-re-join-stdout-from-multiple-processes
* almost this https://unix.stackexchange.com/a/642563/445125 but better.
* 100000000x lighter than this https://www.multipath-tcp.org/ (but mooltipath only works for pipes / streams, whereas MPTCP transparently splits any TCP traffic).

## see also
* https://news.ycombinator.com/item?id=8329507

* https://www.quora.com/Is-there-a-way-to-aggregate-bandwidth-from-multiple-accessible-internet-connections-into-a-bigger-faster-connection

* https://speedify.com/features/channel-bonding/
^ splits your packets and recombines them (but only on their servers in the internet)

* HPSSH

## status
this naive nodejs implementation ended up being even much slower than expected. But streams can work in this callback mode, or in a "direct"/polling? mode of calling read(), so there's still some hope for a js implementation. Another issue was that i couldn't find a js JSON or CBOR library that'd allow streaming parsing. 

## future
I'd like to build next version with C++,Qt and CBOR. 


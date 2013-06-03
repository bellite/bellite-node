![Bellite Logo](http://bellite.io/assets/img/Bellite_main.svg)
[bellite-node][]
================

Node.js bindings for the [Bellite.io][] desktop application toolkit
using [JSON-RPC2][]-based message passing API. This module wraps the [IPC
interface][ipc], providing complete access to the [Command API][cmd] and
[Events][evt] for creating rich desktop applications.

After creating a Bellite object, the module will use the `BELLITE_SERVER`
credentials to connect with the host Bellite process and [authorize][] the
two-way JSON-RPC2 connection. 


## Usage
```javascript
"use strict";
var bellite=require('../bellite.js'),
    app = bellite.Bellite();

app.ready.done(function() {
    app.bindEvent(-1, 'navigate');
    app.on('navigate', function(eobj) {
      console.log('on navigate:', eobj);
    });

    app.perform(-1, 'navigateNew', {'url':'https://github.com/bellite/'}).then(function(eobj) {
      console.log('navigateNew:', eobj);
    });

    app.perform(-1, 'pathVars').then(function(eobj) {
      console.log('pathVars:', eobj);
    });
});
```

## Interface

The Bellite object extends [EventEmitter][], and reflects all [Bellite
events][evt] to [`.emit`][emit] calls. For each [IPC][ipc] method call, a
[promise/A+][promise] instance is returned, to be fullfilled or rejected 
after the Bellite host process responds.


### Interprocess API

- [`.ping()`](http://bellite.io/-stg-/docs/api/#ipc.ping)
- [`.version()`](http://bellite.io/-stg-/docs/api/#ipc.version)
- [`.perform()`](http://bellite.io/-stg-/docs/api/#ipc.perform)
- [`.respondsTo()`](http://bellite.io/-stg-/docs/api/#ipc.respondsTo)
- [`.bindEvent()`](http://bellite.io/-stg-/docs/api/#ipc.bindEvent)
  Binds an event listener in the host process — be sure attach a callback using [EventEmitter][]'s `.on()` method.
- [`.unbindEvent()`](http://bellite.io/-stg-/docs/api/#ipc.unbindEvent)




 [Bellite.io]: http://bellite.io "Hybrid Desktop Applications for Windows and Mac OSX"
 [JSON-RPC2]: http://www.jsonrpc.org/specification "JSON-RPC is a stateless, light-weight remote procedure call (RPC) protocol"
 [ipc]: http://bellite.io/-stg-/docs/api/#ipc "Interprocess API"
 [cmd]: http://bellite.io/-stg-/docs/api/#cmd "Commands API"
 [evt]: http://bellite.io/-stg-/docs/api/#evt "Events API"
 [bellite-node]: https://npmjs.org/package/bellite "bellite-node npm module"

 [authorize]: http://bellite.io/-stg-/docs/api/#ipc.authorize "Bellite authorize process"
 [EventEmitter]: http://nodejs.org/api/events.html#events_class_events_eventemitter "EventEmitter class"
 [emit]: http://nodejs.org/api/events.html#events_emitter_emit_event_arg1_arg2 "emitter.emit()"
 [promise]: https://github.com/promises-aplus/promises-spec "Promise/A+ spec"


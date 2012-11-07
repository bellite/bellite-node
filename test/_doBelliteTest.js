"use strict";
var bellite=require('../bellite.js'),
    app = bellite.Bellite();

//console.log("testBellite!", process.env.BELLITE_SERVER)
app.on('ready', function() {
    app.ping()
    app.version()

    app.perform(142, "echo", {"name":[null, true, 42, "value"]})

    app.bindEvent(118, "*")
    app.unbindEvent(118, "*")

    app.on('testEvent', function(eobj) {
        if (eobj.evt)
            app.perform(0, eobj.evt)
        else app.close()
    })
    app.bindEvent(0, "testEvent", 42, {'testCtx': true})
    app.perform(0, "testEvent")
})

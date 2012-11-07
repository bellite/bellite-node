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

    app.bindEvent(119, "appTimer", 2, {"myContext": 2142})
    app.unbindEvent(119, "appTimer")

    app.on('testComplete', function() { app.close() })
    app.bindEvent(0, "testComplete")
    app.perform(0, "testComplete")
})

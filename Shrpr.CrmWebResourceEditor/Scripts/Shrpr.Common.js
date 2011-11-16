///<summary>Registers a namespace</summary>
///<param name="ns">The namespace that is registered as string</param>
function shrpr_registerNS(ns) {
    var nsParts = ns.split(".");
    var root = window;

    for (var i = 0; i < nsParts.length; i++) {
        if (typeof root[nsParts[i]] == "undefined")
            root[nsParts[i]] = {__namespace : true};

        root = root[nsParts[i]];
    }
    return root;
}

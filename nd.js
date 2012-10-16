(function (root) {

    "use strict";

    var nd = {"version": "0.0.1"};

    if (typeof exports !== "undefined") {
        if (typeof module !== "undefined" && module.exports) {
            exports = module.exports = nd;
        }
        exports.nd = nd;
    } else {
        root["nd"] = nd;
    }


    // Utilities.
    nd.shape = function (obj) {
        if (typeof(obj) === "number") return 0;
        var i, result = [obj.length], s = nd.shape(obj[0]);
        for (i = 0; i < s.length; i++) result.push(s[i]);
        return result;
    };

    nd.flatten = function (obj) {
        if (typeof(obj) === "number") return [obj];
        var i, j, flat, result = [];
        for (i = 0; i < obj.length; i++) {
            flat = nd.flatten(obj[i]);
            for (j = 0; j < flat.length; j++) result.push(flat[j]);
        }
        return result;
    };


    // Slicing.
    nd.slice = function () {
        var l = arguments.length,
            s = {"type": "nd.slice"};

        if (l > 3) throw "Too many arguments.";
        if (!l) {
            s.start = 0;
            s.end = undefined;
            s.step = 1;
        } else if (l == 1) {
            s.start = 0;
            s.end = arguments[0];
            s.step = 1;
        } else if (l > 1) {
            s.start = arguments[0];
            s.end = arguments[1];
            s.step = 1;
            if (l == 3) s.step = arguments[2];
        }
        if (s.step == 0) throw "Invalid step size.";

        s.init = function () {
            s.done = false;
            s.current = s.start;
            return s.current;
        };
        s.next = function () {
            s.current += s.step;
            s.done = (s.current >= s.end);
            return s.current;
        };

        s.size = function () { return Math.ceil((s.end - s.start) / s.step) };

        return s;
    };

    nd._wrap_as_slice = function (obj, size) {
        if (obj.type === "nd.slice") {
            // Full slices have `undefined` as the end point.
            if (typeof obj.end === "undefined") obj.end = size;

            // Deal with wrapping.
            while (obj.end < 0) obj.end += size;
            while (obj.start < 0) obj.start += size;

            return obj;
        }
        if (typeof obj === "number") {
            while (obj < 0) obj += size;
            var r = {init: function () { r.done = false; return obj; },
                     next: function () { r.done = true; return obj; },
                     size: 0};
            return r;
        }
        if (typeof obj.length !== "undefined") {
            for (var i in obj)
                while (obj[i] < 0) obj[i] += size;
            var r = {
                init: function () {
                    r.done = false;
                    r._ind = 0;
                    r.current = obj[r._ind];
                    return r.current;
                },
                next: function () {
                    r._ind++;
                    r.done = (r._ind >= obj.length);
                    r.current = obj[r._ind];
                    return r.current;
                },
                size: obj.length
            }
            return r;
        }
        throw "Not implemented.";
    };


    // Arithmetic.
    nd.sum = function (obj) {
        if (obj.type in ["nd.matrix", "nd.vector"])
            obj = ob._array;
        return _.reduce(obj, function (curr, val) { return curr + val; }, 0.0);
    };
    nd.dotVV = function (v1, v2) {
        if (v1.size !== v2.size) throw "Dimension mismatch.";
        return nd.sum(_.map(v1._array, function (d, i) {
                                                return d * v2._array[i]; }));
    };
    nd.dot = function (a, b) {
        a = nd.matrix(a); b = nd.matrix(b);
        if (a.type === "nd.vector" && b.type === "nd.vector")
            return nd.dotVV(a, b);
        throw "Not implmented.";
    };


    // Base objects.
    nd.vector = function (basearray) {
        if (basearray.type === "nd.vector")
            return basearray;

        var v = function () { return v.call.apply(this, arguments); };
        v.type = "nd.vector";
        v._array = basearray;
        v.size = basearray.length;

        v.call = function (ind, val) {
            if (typeof ind === "number") {
                while (ind < 0) ind += v.size;
                if (typeof val === "undefined")
                    return v._array[ind];
                v._array[ind] = val;
                return m;
            }

            ind = nd._wrap_as_slice(ind, v.size);

            // Are we setting the slice to something?
            var setting = (typeof val !== "undefined");
            if (setting && typeof val !== "number" &&
                ((typeof ind.size === "function" && val.length !== ind.size())
                 || val.length !== ind.size))
                throw "Dimension mismatch.";

            var setter;
            if (typeof val === "number")
                setter = function () { return val; };
            else setter = function (i) { return val[i]; };

            var j = 0, result = [];
            for (var i = ind.init(); !ind.done; i = ind.next()) {
                if (i >= v.size || i < 0) throw "Out of bounds.";
                if (setting)
                    v._array[i] = setter(j++);
                else
                    result.push(v._array[i]);
            }

            if (setting) return v;
            return nd.vector(result);
        };

        v.array = function () { return v._array; };
        v.toString = function () {
            var s ="nd.vector([";;
            for (var i = 0; i < v.size; ++i)
                s += v._array[i] + ", ";
            return s.substring(0, s.length - 2) + "])";
        };

        return v;
    };

    nd.matrix = function (basearray, shape) {
        if (basearray.type in ["nd.matrix", "nd.vector"])
            return basearray;

        var m = function () { return m.call.apply(this, arguments); };
        m.type = "nd.matrix";
        m._array = nd.flatten(basearray);

        // Compute the shape.
        if (typeof shape === "undefined")
            shape = nd.shape(basearray);
        if (shape.length === 1) return nd.vector(basearray);
        if (shape.length !== 2) throw "A nd.matrix must be 2 dimensional.";
        m.shape = shape;
        m.size = m._array.length;

        // Indexing.
        m._row = function (i) {
            return m._array.slice(i * m.shape[1], (i + 1) * m.shape[1]);
        };
        m.row = function (i) { return nd.vector(m._row(i)); };
        m._col = function (i) {
            var result = [];
            for (var j = 0; j < m.shape[0]; ++j)
                result.push(m._array[j * m.shape[1] + i]);
            return result;
        };
        m.col = function (i) { return nd.vector(m._col); };

        m.call = function (i, j, val) {
            if (typeof j === "undefined") j = nd.slice();

            if (typeof i === "number" && typeof j === "number") {
                while (i < 0) i += m.shape[0];
                while (j < 0) j += m.shape[1];
                if (typeof val === "undefined")
                    return m._array[m.ravel_index([i, j])];
                m._array[m.ravel_index([i, j])] = val;
                return m;
            }

            // Wrap the index masks as iterators regardless of type.
            i = nd._wrap_as_slice(i, m.shape[0]);
            j = nd._wrap_as_slice(j, m.shape[1]);

            // Compute the new shape.
            var newshape = [], newsize, is_vector = false;
            if (typeof i.size === "function") newshape.push(i.size());
            else newshape.push(i.size);
            if (typeof j.size === "function") newshape.push(j.size());
            else newshape.push(j.size);

            // Deal with scalar dimensions.
            if (newshape[0] === 0) { is_vector = true;newsize = newshape[0]; }
            else if (newshape[1] === 0) { is_vector = true;newsize = newshape[1]; }
            else newsize = newshape[0] * newshape[1];

            // Are we setting the slice to something?
            var setting = (typeof val !== "undefined");
            if (setting && typeof val !== "number" && val.length !== newsize)
                throw "Dimension mismatch.";

            var setter;
            if (typeof val === "number")
                setter = function () { return val; };
            else setter = function (i) { return val[i]; };

            // Iterate over slices.
            var result = [], ind = 0;
            for (var ii = i.init(); !i.done; ii = i.next()) {
                for (var jj = j.init(); !j.done; jj = j.next()) {
                    if (ii >= m.shape[0] || ii < 0 ||
                        jj >= m.shape[1] || jj < 0) throw "Out of bounds.";
                    if (setting)
                        m._array[m.ravel_index([ii, jj])] = setter(ind++);
                    else
                        result.push(m._array[m.ravel_index([ii, jj])]);
                }
            }

            // Exit if we were setting.
            if (setting) return m;
            if (is_vector) return nd.vector(result);
            return nd.matrix(result, newshape);
        };

        // Convert between flattened and un-flattened coordinates.
        m.unravel_index = function (i) {
            if (i >= m.size) throw "Out of bounds.";
            var mod = Math.floor(i / m.shape[1]);
            return [mod, i - mod * m.shape[1]];
        };
        m.ravel_index = function (coords) {
            if (coords.length !== 2) throw "Incorrect number of arguments.";
            while (coords[0] < 0) coords[0] += m.shape[0];
            while (coords[1] < 0) coords[1] += m.shape[1];
            if (coords[0] >= m.shape[0] || coords[1] >= m.shape[1])
                throw "Out of bounds.";
            return coords[0] * m.shape[1] + coords[1];
        };

        // Rebuild the native 2D array.
        m.array = function () {
            var result = [], ind = 0;
            for (var i = 0; i < m.shape[0]; ++i) {
                var tmp = [];
                for (var j = 0; j < m.shape[1]; ++j)
                    tmp.push(m._array[ind++]);
                result.push(tmp);
            }
            return result;
        };

        m.toString = function () {
            var s = "nd.matrix([", ind = 0;
            for (var i = 0; i < m.shape[0]; ++i) {
                s += "[";
                for (var j = 0; j < m.shape[1]; ++j)
                    s += m._array[ind++] + ", ";
                s = s.substring(0, s.length - 2) + "], ";
            }
            return s.substring(0, s.length - 2) + "])";
        };

        return m;
    };

})(this);

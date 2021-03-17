Object.defineProperty(String.prototype, "cleanVal", {
    value: function cleanVal() {
        return this.split("\'").join("").split(".").join("").toLowerCase().split("-").join(" ");
    },
    writable: true,
    configurable: true
  });
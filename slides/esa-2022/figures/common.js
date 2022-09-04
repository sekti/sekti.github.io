// #################
// Hashing Schemes
// #################

//fully random
function randomInt(max) {
    return Math.floor(Math.random()*max);
}
function randomNode(G){
        return randomInt(G.n);
}
// 
function randomDistinctNodes(){
    // should be called with a graph as this
    const S = new Set();
    while(S.size < this.k) {
        S.add(randomNode(this));
    }
    return Array.from(S);
}
function doubleHashing() {
    const a = randomNode(this);
    let b = randomNode(this);
    while (b == 0) b = randomNode(this);
    return d3.range(this.k).map(i => (a + b*i) % this.n );
}
function blockedHashing() {
    // quick and dirty, change n
        this.n /= this.l
        const A = randomDistinctNodes.call(this);
        this.n *= this.l
    return A.map(i => d3.range(this.l).map(j => i*this.l+j)).flat();
}
function unalignedBlocks() {
    for(;;) {
        let A = randomDistinctNodes.call(this);
        const diff = Math.abs(A[0] - A[1]);
        if (diff <= this.l || this.n-diff <= this.l) continue;
        return A.map(i => d3.range(this.l).map(j => (i+j) % this.n)).flat();
    }
}
function randomSubset(l) {
    for(;;) {
        const i = randomInt(1 << l);
        if (!i) continue; // macht nur ärger
        return d3.range(l).map(j => (i & (1 << j)) ? 1 : 0 );
    }
}
function blockedIgnoreSubset() {
    this.n /= this.l;
    const A = randomDistinctNodes.call(this);
    this.n *= this.l;
    const subsets = d3.range(this.k).map(i => randomSubset(this.l));
    return A.map(b => d3.range(this.l).map(j => b*this.l+j)).flat();
}
function blockedSubset() {
    this.n /= this.l;
    const A = randomDistinctNodes.call(this);
    this.n *= this.l;
    const subsets = d3.range(this.k).map(i => randomSubset(this.l));
    return A.map((b,i) => d3.range(this.l).filter(j => subsets[i][j]).map(j => b*this.l+j)).flat();
}
function unalignedBlockSubset() {
    const start = randomInt(this.n-this.l+1);
    const subset = randomSubset(this.l);
    return d3.range(this.l).filter(j => subset[j]).map(j => start + j);
}
function hardcodedHashes(array) {
    var index = 0;
    return () => array[index++];
}

// generate transition array
function fromFrames(sequence) {
    const dicts = sequence.slice(1).map(x => ({ transitionForward: x}));
    dicts[0].transitionBackward = sequence[0];
    sequence[0]();
    return dicts;
}

var spatialCouplingCentres = []
function spatialCoupling() {
    const y = Math.random()*this.z;
    spatialCouplingCentres.push(y+0.5);
    const min = Math.floor(y * this.n / (this.z+1));
    const max = Math.floor((y+1) * this.n / (this.z+1));
    if (max - min < this.k) {
        console.log("Not enough choices.")
        return [];
    }
    const oldN = this.n;
    this.n = max - min + 1
    const nodes = randomDistinctNodes.call(this);
    this.n = oldN;
    return nodes.map(i => i + min);
}

function processOptions() {
    if (queryDict["animWait"]) {
        const waits = queryDict["animWait"].split(",");
        const NOP = {
            transitionForward: () => {},
            transitionBackward: () => {},
        }
        let shiftedTransitions = []
        _transitions.forEach((t,i) => {
            d3.range(+waits[i] || 0).forEach(() => shiftedTransitions.push(NOP));
            if (+waits[i] && !t.transitionBackward && i && _transitions[i-1].transitionForward) {
                t.transitionBackward = _transitions[i-1].transitionForward;
            }
            shiftedTransitions.push(t);
        });
        _transitions = shiftedTransitions;
    }
    const staticFrame = queryDict["static"];
    if (staticFrame) {
        d3.range(+staticFrame).forEach(i => {
            _transitions[i].transitionForward()
        });
        _transitions = null;
    }
}
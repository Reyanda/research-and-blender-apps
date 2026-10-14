var JLO=S(()=>{cH();h07=W_(vU(),1);Xs=class Xs extends IY{constructor(O,z,w){let W={parent:O,baseUrl:"/channels",id:"",methods:{}};super(W);this.metadata.id=z,this.metadata.resourceId=w}stop(O){O=O||DW.noop,this.request({method:"POST",uri:"/stop",json:this.metadata},(z,w)=>{O(z,w)})}};/*! Developer Documentation
 *
 * All async methods (except for streams) will return a Promise in the event
 * that a callback is omitted.
 */h07.promisifyAll(Xs)});var P07,Qs;
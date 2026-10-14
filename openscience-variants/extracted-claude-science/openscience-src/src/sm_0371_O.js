var Hxz=S(()=>{Ut_();lq();a7();T4w=function(){function O(z,w){this.encoding=z===iI.ZapfDingbats?zw_.ZapfDingbats:z===iI.Symbol?zw_.Symbol:zw_.WinAnsi,this.font=zxz.load(z),this.fontName=this.font.FontName,this.customName=w}return O.prototype.encodeText=function(z){var w=this.encodeTextAsGlyphs(z),W=Array(w.length);for(var G=0,x=w.length;G<x;G++)W[G]=mM(w[G].code);return Lz.of(W.join(""))},O.prototype.widthOfTextAtSize=function(z,w){var W=this.encodeTextAsGlyphs(z),G=0;for(var x=0,Y=W.length;x<Y;x++){var K=W[x].name,y=(W[x+1]||{}).name,q=this.font.getXAxisKerningForPair(K,y)||0;G+=this.widthOfGlyph(K)+q}var Z=w/1000;return G*Z},O.prototype.heightOfFontAtSize=function(z,w){if(w===void 0)w={};var W=w.descender,G=W===void 0?!0:W,x=this.font,Y=x.Ascender,K=x.Descender,y=x.FontBBox,q=Y||y[3],Z=K||y[1],X=q-Z;if(!G)X+=K||0;return X/1000*z},O.prototype.sizeOfFontAtHeight=function(z){var w=this.font,W=w.Ascender,G=w.Descender,x=w.FontBBox,Y=W||x[3],K=G||x[1];return 1000*z/(Y-K)},O.prototype.embedIntoContext=function(z,w){var W=z.obj({Type:"Font",Subtype:"Type1",BaseFont:this.customName||this.fontName,Encoding:this.encoding===zw_.WinAnsi?"WinAnsiEncoding":void 0});if(w)return z.assign(w,W),w;else return z.register(W)},O.prototype.widthOfGlyph=function(z){return this.font.getWidthOfGlyph(z)||250},O.prototype.encodeTextAsGlyphs=function(z){var w=Array.from(z),W=Array(w.length);for(var G=0,x=w.length;G<x;G++){var Y=Nr_(w[G]);W[G]=this.encoding.encodeUnicodeCodePoint(Y)}return W},O.for=function(z,w){return new O(z,w)},O}(),bj=T4w});var Axz=function(O,z){var w=Array(O.length);for(var W=0,G=O.length;W<G;W++){var x=O[W],Y=Exz(RN_(z(x))),K=Exz.apply(void 0,x.codePoints.map(P4w));w[W]=[Y,K]}return h4w(w)},h4w=function(O){return`/CIDInit /ProcSet findresource begin
12 dict begin
begincmap
/CIDSystemInfo <<
  /Registry (Adobe)
  /Ordering (UCS)
  /Supplement 0
>> def
/CMapName /Adobe-Identity-UCS def
/CMapType 2 def
1 begincodespacerange
<0000><ffff>
endcodespacerange
`+O.length+` beginbfchar
`+O.map(function(z){var w=z[0],W=z[1];return w+" "+W}).join(`
`)+`
endbfchar
endcmap
CMapName currentdict /CMap defineresource pop
end
end`},Exz=function(){var O=[];for(var z=0;z<arguments.length;z++)O[z]=arguments[z];return"<"+O.join("")+">"},RN_=function(O){return uM(O,4)},P4w=function(O){if(Er_(O))return RN_(O);if(Ar_(O)){var z=ON_(O),w=zN_(O);return""+RN_(z)+RN_(w)}var W=mM(O),G="0x"+W+" is not a valid UTF-8 or UTF-16 codepoint.";throw Error(G)};
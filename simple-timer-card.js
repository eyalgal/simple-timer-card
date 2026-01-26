/**
 * @license
 * Copyright 2019 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const t=globalThis,e=t.ShadowRoot&&(void 0===t.ShadyCSS||t.ShadyCSS.nativeShadow)&&"adoptedStyleSheets"in Document.prototype&&"replace"in CSSStyleSheet.prototype,i=Symbol(),s=new WeakMap;let r=class{constructor(t,e,s){if(this._$cssResult$=!0,s!==i)throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");this.cssText=t,this.t=e}get styleSheet(){let t=this.o;const i=this.t;if(e&&void 0===t){const e=void 0!==i&&1===i.length;e&&(t=s.get(i)),void 0===t&&((this.o=t=new CSSStyleSheet).replaceSync(this.cssText),e&&s.set(i,t))}return t}toString(){return this.cssText}};const n=(t,...e)=>{const s=1===t.length?t[0]:e.reduce((e,i,s)=>e+(t=>{if(!0===t._$cssResult$)return t.cssText;if("number"==typeof t)return t;throw Error("Value passed to 'css' function must be a 'css' function result: "+t+". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.")})(i)+t[s+1],t[0]);return new r(s,t,i)},o=e?t=>t:t=>t instanceof CSSStyleSheet?(t=>{let e="";for(const i of t.cssRules)e+=i.cssText;return(t=>new r("string"==typeof t?t:t+"",void 0,i))(e)})(t):t,{is:a,defineProperty:l,getOwnPropertyDescriptor:c,getOwnPropertyNames:d,getOwnPropertySymbols:u,getPrototypeOf:h}=Object,m=globalThis,_=m.trustedTypes,p=_?_.emptyScript:"",g=m.reactiveElementPolyfillSupport,f=(t,e)=>t,v={toAttribute(t,e){switch(e){case Boolean:t=t?p:null;break;case Object:case Array:t=null==t?t:JSON.stringify(t)}return t},fromAttribute(t,e){let i=t;switch(e){case Boolean:i=null!==t;break;case Number:i=null===t?null:Number(t);break;case Object:case Array:try{i=JSON.parse(t)}catch(t){i=null}}return i}},y=(t,e)=>!a(t,e),b={attribute:!0,type:String,converter:v,reflect:!1,useDefault:!1,hasChanged:y};
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */Symbol.metadata??=Symbol("metadata"),m.litPropertyMetadata??=new WeakMap;let $=class extends HTMLElement{static addInitializer(t){this._$Ei(),(this.l??=[]).push(t)}static get observedAttributes(){return this.finalize(),this._$Eh&&[...this._$Eh.keys()]}static createProperty(t,e=b){if(e.state&&(e.attribute=!1),this._$Ei(),this.prototype.hasOwnProperty(t)&&((e=Object.create(e)).wrapped=!0),this.elementProperties.set(t,e),!e.noAccessor){const i=Symbol(),s=this.getPropertyDescriptor(t,i,e);void 0!==s&&l(this.prototype,t,s)}}static getPropertyDescriptor(t,e,i){const{get:s,set:r}=c(this.prototype,t)??{get(){return this[e]},set(t){this[e]=t}};return{get:s,set(e){const n=s?.call(this);r?.call(this,e),this.requestUpdate(t,n,i)},configurable:!0,enumerable:!0}}static getPropertyOptions(t){return this.elementProperties.get(t)??b}static _$Ei(){if(this.hasOwnProperty(f("elementProperties")))return;const t=h(this);t.finalize(),void 0!==t.l&&(this.l=[...t.l]),this.elementProperties=new Map(t.elementProperties)}static finalize(){if(this.hasOwnProperty(f("finalized")))return;if(this.finalized=!0,this._$Ei(),this.hasOwnProperty(f("properties"))){const t=this.properties,e=[...d(t),...u(t)];for(const i of e)this.createProperty(i,t[i])}const t=this[Symbol.metadata];if(null!==t){const e=litPropertyMetadata.get(t);if(void 0!==e)for(const[t,i]of e)this.elementProperties.set(t,i)}this._$Eh=new Map;for(const[t,e]of this.elementProperties){const i=this._$Eu(t,e);void 0!==i&&this._$Eh.set(i,t)}this.elementStyles=this.finalizeStyles(this.styles)}static finalizeStyles(t){const e=[];if(Array.isArray(t)){const i=new Set(t.flat(1/0).reverse());for(const t of i)e.unshift(o(t))}else void 0!==t&&e.push(o(t));return e}static _$Eu(t,e){const i=e.attribute;return!1===i?void 0:"string"==typeof i?i:"string"==typeof t?t.toLowerCase():void 0}constructor(){super(),this._$Ep=void 0,this.isUpdatePending=!1,this.hasUpdated=!1,this._$Em=null,this._$Ev()}_$Ev(){this._$ES=new Promise(t=>this.enableUpdating=t),this._$AL=new Map,this._$E_(),this.requestUpdate(),this.constructor.l?.forEach(t=>t(this))}addController(t){(this._$EO??=new Set).add(t),void 0!==this.renderRoot&&this.isConnected&&t.hostConnected?.()}removeController(t){this._$EO?.delete(t)}_$E_(){const t=new Map,e=this.constructor.elementProperties;for(const i of e.keys())this.hasOwnProperty(i)&&(t.set(i,this[i]),delete this[i]);t.size>0&&(this._$Ep=t)}createRenderRoot(){const i=this.shadowRoot??this.attachShadow(this.constructor.shadowRootOptions);return((i,s)=>{if(e)i.adoptedStyleSheets=s.map(t=>t instanceof CSSStyleSheet?t:t.styleSheet);else for(const e of s){const s=document.createElement("style"),r=t.litNonce;void 0!==r&&s.setAttribute("nonce",r),s.textContent=e.cssText,i.appendChild(s)}})(i,this.constructor.elementStyles),i}connectedCallback(){this.renderRoot??=this.createRenderRoot(),this.enableUpdating(!0),this._$EO?.forEach(t=>t.hostConnected?.())}enableUpdating(t){}disconnectedCallback(){this._$EO?.forEach(t=>t.hostDisconnected?.())}attributeChangedCallback(t,e,i){this._$AK(t,i)}_$ET(t,e){const i=this.constructor.elementProperties.get(t),s=this.constructor._$Eu(t,i);if(void 0!==s&&!0===i.reflect){const r=(void 0!==i.converter?.toAttribute?i.converter:v).toAttribute(e,i.type);this._$Em=t,null==r?this.removeAttribute(s):this.setAttribute(s,r),this._$Em=null}}_$AK(t,e){const i=this.constructor,s=i._$Eh.get(t);if(void 0!==s&&this._$Em!==s){const t=i.getPropertyOptions(s),r="function"==typeof t.converter?{fromAttribute:t.converter}:void 0!==t.converter?.fromAttribute?t.converter:v;this._$Em=s;const n=r.fromAttribute(e,t.type);this[s]=n??this._$Ej?.get(s)??n,this._$Em=null}}requestUpdate(t,e,i,s=!1,r){if(void 0!==t){const n=this.constructor;if(!1===s&&(r=this[t]),i??=n.getPropertyOptions(t),!((i.hasChanged??y)(r,e)||i.useDefault&&i.reflect&&r===this._$Ej?.get(t)&&!this.hasAttribute(n._$Eu(t,i))))return;this.C(t,e,i)}!1===this.isUpdatePending&&(this._$ES=this._$EP())}C(t,e,{useDefault:i,reflect:s,wrapped:r},n){i&&!(this._$Ej??=new Map).has(t)&&(this._$Ej.set(t,n??e??this[t]),!0!==r||void 0!==n)||(this._$AL.has(t)||(this.hasUpdated||i||(e=void 0),this._$AL.set(t,e)),!0===s&&this._$Em!==t&&(this._$Eq??=new Set).add(t))}async _$EP(){this.isUpdatePending=!0;try{await this._$ES}catch(t){Promise.reject(t)}const t=this.scheduleUpdate();return null!=t&&await t,!this.isUpdatePending}scheduleUpdate(){return this.performUpdate()}performUpdate(){if(!this.isUpdatePending)return;if(!this.hasUpdated){if(this.renderRoot??=this.createRenderRoot(),this._$Ep){for(const[t,e]of this._$Ep)this[t]=e;this._$Ep=void 0}const t=this.constructor.elementProperties;if(t.size>0)for(const[e,i]of t){const{wrapped:t}=i,s=this[e];!0!==t||this._$AL.has(e)||void 0===s||this.C(e,void 0,i,s)}}let t=!1;const e=this._$AL;try{t=this.shouldUpdate(e),t?(this.willUpdate(e),this._$EO?.forEach(t=>t.hostUpdate?.()),this.update(e)):this._$EM()}catch(e){throw t=!1,this._$EM(),e}t&&this._$AE(e)}willUpdate(t){}_$AE(t){this._$EO?.forEach(t=>t.hostUpdated?.()),this.hasUpdated||(this.hasUpdated=!0,this.firstUpdated(t)),this.updated(t)}_$EM(){this._$AL=new Map,this.isUpdatePending=!1}get updateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._$ES}shouldUpdate(t){return!0}update(t){this._$Eq&&=this._$Eq.forEach(t=>this._$ET(t,this[t])),this._$EM()}updated(t){}firstUpdated(t){}};$.elementStyles=[],$.shadowRootOptions={mode:"open"},$[f("elementProperties")]=new Map,$[f("finalized")]=new Map,g?.({ReactiveElement:$}),(m.reactiveElementVersions??=[]).push("2.1.2");
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const x=globalThis,w=t=>t,T=x.trustedTypes,S=T?T.createPolicy("lit-html",{createHTML:t=>t}):void 0,k="$lit$",A=`lit$${Math.random().toFixed(9).slice(2)}$`,C="?"+A,E=`<${C}>`,z=document,P=()=>z.createComment(""),M=t=>null===t||"object"!=typeof t&&"function"!=typeof t,V=Array.isArray,D="[ \t\n\f\r]",N=/<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g,I=/-->/g,U=/>/g,q=RegExp(`>|${D}(?:([^\\s"'>=/]+)(${D}*=${D}*(?:[^ \t\n\f\r"'\`<>=]|("|')|))|$)`,"g"),j=/'/g,L=/"/g,O=/^(?:script|style|textarea|title)$/i,H=(t=>(e,...i)=>({_$litType$:t,strings:e,values:i}))(1),R=Symbol.for("lit-noChange"),F=Symbol.for("lit-nothing"),W=new WeakMap,B=z.createTreeWalker(z,129);function J(t,e){if(!V(t)||!t.hasOwnProperty("raw"))throw Error("invalid template strings array");return void 0!==S?S.createHTML(e):e}const K=(t,e)=>{const i=t.length-1,s=[];let r,n=2===e?"<svg>":3===e?"<math>":"",o=N;for(let e=0;e<i;e++){const i=t[e];let a,l,c=-1,d=0;for(;d<i.length&&(o.lastIndex=d,l=o.exec(i),null!==l);)d=o.lastIndex,o===N?"!--"===l[1]?o=I:void 0!==l[1]?o=U:void 0!==l[2]?(O.test(l[2])&&(r=RegExp("</"+l[2],"g")),o=q):void 0!==l[3]&&(o=q):o===q?">"===l[0]?(o=r??N,c=-1):void 0===l[1]?c=-2:(c=o.lastIndex-l[2].length,a=l[1],o=void 0===l[3]?q:'"'===l[3]?L:j):o===L||o===j?o=q:o===I||o===U?o=N:(o=q,r=void 0);const u=o===q&&t[e+1].startsWith("/>")?" ":"";n+=o===N?i+E:c>=0?(s.push(a),i.slice(0,c)+k+i.slice(c)+A+u):i+A+(-2===c?e:u)}return[J(t,n+(t[i]||"<?>")+(2===e?"</svg>":3===e?"</math>":"")),s]};class G{constructor({strings:t,_$litType$:e},i){let s;this.parts=[];let r=0,n=0;const o=t.length-1,a=this.parts,[l,c]=K(t,e);if(this.el=G.createElement(l,i),B.currentNode=this.el.content,2===e||3===e){const t=this.el.content.firstChild;t.replaceWith(...t.childNodes)}for(;null!==(s=B.nextNode())&&a.length<o;){if(1===s.nodeType){if(s.hasAttributes())for(const t of s.getAttributeNames())if(t.endsWith(k)){const e=c[n++],i=s.getAttribute(t).split(A),o=/([.?@])?(.*)/.exec(e);a.push({type:1,index:r,name:o[2],strings:i,ctor:"."===o[1]?tt:"?"===o[1]?et:"@"===o[1]?it:Z}),s.removeAttribute(t)}else t.startsWith(A)&&(a.push({type:6,index:r}),s.removeAttribute(t));if(O.test(s.tagName)){const t=s.textContent.split(A),e=t.length-1;if(e>0){s.textContent=T?T.emptyScript:"";for(let i=0;i<e;i++)s.append(t[i],P()),B.nextNode(),a.push({type:2,index:++r});s.append(t[e],P())}}}else if(8===s.nodeType)if(s.data===C)a.push({type:2,index:r});else{let t=-1;for(;-1!==(t=s.data.indexOf(A,t+1));)a.push({type:7,index:r}),t+=A.length-1}r++}}static createElement(t,e){const i=z.createElement("template");return i.innerHTML=t,i}}function Q(t,e,i=t,s){if(e===R)return e;let r=void 0!==s?i._$Co?.[s]:i._$Cl;const n=M(e)?void 0:e._$litDirective$;return r?.constructor!==n&&(r?._$AO?.(!1),void 0===n?r=void 0:(r=new n(t),r._$AT(t,i,s)),void 0!==s?(i._$Co??=[])[s]=r:i._$Cl=r),void 0!==r&&(e=Q(t,r._$AS(t,e.values),r,s)),e}class Y{constructor(t,e){this._$AV=[],this._$AN=void 0,this._$AD=t,this._$AM=e}get parentNode(){return this._$AM.parentNode}get _$AU(){return this._$AM._$AU}u(t){const{el:{content:e},parts:i}=this._$AD,s=(t?.creationScope??z).importNode(e,!0);B.currentNode=s;let r=B.nextNode(),n=0,o=0,a=i[0];for(;void 0!==a;){if(n===a.index){let e;2===a.type?e=new X(r,r.nextSibling,this,t):1===a.type?e=new a.ctor(r,a.name,a.strings,this,t):6===a.type&&(e=new st(r,this,t)),this._$AV.push(e),a=i[++o]}n!==a?.index&&(r=B.nextNode(),n++)}return B.currentNode=z,s}p(t){let e=0;for(const i of this._$AV)void 0!==i&&(void 0!==i.strings?(i._$AI(t,i,e),e+=i.strings.length-2):i._$AI(t[e])),e++}}class X{get _$AU(){return this._$AM?._$AU??this._$Cv}constructor(t,e,i,s){this.type=2,this._$AH=F,this._$AN=void 0,this._$AA=t,this._$AB=e,this._$AM=i,this.options=s,this._$Cv=s?.isConnected??!0}get parentNode(){let t=this._$AA.parentNode;const e=this._$AM;return void 0!==e&&11===t?.nodeType&&(t=e.parentNode),t}get startNode(){return this._$AA}get endNode(){return this._$AB}_$AI(t,e=this){t=Q(this,t,e),M(t)?t===F||null==t||""===t?(this._$AH!==F&&this._$AR(),this._$AH=F):t!==this._$AH&&t!==R&&this._(t):void 0!==t._$litType$?this.$(t):void 0!==t.nodeType?this.T(t):(t=>V(t)||"function"==typeof t?.[Symbol.iterator])(t)?this.k(t):this._(t)}O(t){return this._$AA.parentNode.insertBefore(t,this._$AB)}T(t){this._$AH!==t&&(this._$AR(),this._$AH=this.O(t))}_(t){this._$AH!==F&&M(this._$AH)?this._$AA.nextSibling.data=t:this.T(z.createTextNode(t)),this._$AH=t}$(t){const{values:e,_$litType$:i}=t,s="number"==typeof i?this._$AC(t):(void 0===i.el&&(i.el=G.createElement(J(i.h,i.h[0]),this.options)),i);if(this._$AH?._$AD===s)this._$AH.p(e);else{const t=new Y(s,this),i=t.u(this.options);t.p(e),this.T(i),this._$AH=t}}_$AC(t){let e=W.get(t.strings);return void 0===e&&W.set(t.strings,e=new G(t)),e}k(t){V(this._$AH)||(this._$AH=[],this._$AR());const e=this._$AH;let i,s=0;for(const r of t)s===e.length?e.push(i=new X(this.O(P()),this.O(P()),this,this.options)):i=e[s],i._$AI(r),s++;s<e.length&&(this._$AR(i&&i._$AB.nextSibling,s),e.length=s)}_$AR(t=this._$AA.nextSibling,e){for(this._$AP?.(!1,!0,e);t!==this._$AB;){const e=w(t).nextSibling;w(t).remove(),t=e}}setConnected(t){void 0===this._$AM&&(this._$Cv=t,this._$AP?.(t))}}class Z{get tagName(){return this.element.tagName}get _$AU(){return this._$AM._$AU}constructor(t,e,i,s,r){this.type=1,this._$AH=F,this._$AN=void 0,this.element=t,this.name=e,this._$AM=s,this.options=r,i.length>2||""!==i[0]||""!==i[1]?(this._$AH=Array(i.length-1).fill(new String),this.strings=i):this._$AH=F}_$AI(t,e=this,i,s){const r=this.strings;let n=!1;if(void 0===r)t=Q(this,t,e,0),n=!M(t)||t!==this._$AH&&t!==R,n&&(this._$AH=t);else{const s=t;let o,a;for(t=r[0],o=0;o<r.length-1;o++)a=Q(this,s[i+o],e,o),a===R&&(a=this._$AH[o]),n||=!M(a)||a!==this._$AH[o],a===F?t=F:t!==F&&(t+=(a??"")+r[o+1]),this._$AH[o]=a}n&&!s&&this.j(t)}j(t){t===F?this.element.removeAttribute(this.name):this.element.setAttribute(this.name,t??"")}}class tt extends Z{constructor(){super(...arguments),this.type=3}j(t){this.element[this.name]=t===F?void 0:t}}class et extends Z{constructor(){super(...arguments),this.type=4}j(t){this.element.toggleAttribute(this.name,!!t&&t!==F)}}class it extends Z{constructor(t,e,i,s,r){super(t,e,i,s,r),this.type=5}_$AI(t,e=this){if((t=Q(this,t,e,0)??F)===R)return;const i=this._$AH,s=t===F&&i!==F||t.capture!==i.capture||t.once!==i.once||t.passive!==i.passive,r=t!==F&&(i===F||s);s&&this.element.removeEventListener(this.name,this,i),r&&this.element.addEventListener(this.name,this,t),this._$AH=t}handleEvent(t){"function"==typeof this._$AH?this._$AH.call(this.options?.host??this.element,t):this._$AH.handleEvent(t)}}class st{constructor(t,e,i){this.element=t,this.type=6,this._$AN=void 0,this._$AM=e,this.options=i}get _$AU(){return this._$AM._$AU}_$AI(t){Q(this,t)}}const rt=x.litHtmlPolyfillSupport;rt?.(G,X),(x.litHtmlVersions??=[]).push("3.3.2");const nt=globalThis;
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */class ot extends ${constructor(){super(...arguments),this.renderOptions={host:this},this._$Do=void 0}createRenderRoot(){const t=super.createRenderRoot();return this.renderOptions.renderBefore??=t.firstChild,t}update(t){const e=this.render();this.hasUpdated||(this.renderOptions.isConnected=this.isConnected),super.update(t),this._$Do=((t,e,i)=>{const s=i?.renderBefore??e;let r=s._$litPart$;if(void 0===r){const t=i?.renderBefore??null;s._$litPart$=r=new X(e.insertBefore(P(),t),t,void 0,i??{})}return r._$AI(t),r})(e,this.renderRoot,this.renderOptions)}connectedCallback(){super.connectedCallback(),this._$Do?.setConnected(!0)}disconnectedCallback(){super.disconnectedCallback(),this._$Do?.setConnected(!1)}render(){return R}}ot._$litElement$=!0,ot.finalized=!0,nt.litElementHydrateSupport?.({LitElement:ot});const at=nt.litElementPolyfillSupport;at?.({LitElement:ot}),(nt.litElementVersions??=[]).push("4.2.2");const lt=864e5,ct=31536e6,dt=3600,ut=86400,ht={en:{no_timers:"No Timers",click_to_start:"Click to start",no_active_timers:"No Active Timers",active_timers:"Active Timers",add:"Add",custom:"Custom",cancel:"Cancel",save:"Save",start:"Start",snooze:"Snooze",dismiss:"Dismiss",ready:"Ready",paused:"Paused",times_up:"Time's up!",timer:"Timer",hour_ago:"hour ago",hours_ago:"hours ago",minute_ago:"minute ago",minutes_ago:"minutes ago",second_ago:"second ago",seconds_ago:"seconds ago",h:"h",m:"m",s:"s",d:"d",w_short:"w",mo_short:"mo",y_short:"y",day:"day",days:"days",week:"week",weeks:"weeks",month:"month",months:"months",year:"year",years:"years",hour:"hour",hours:"hours",minute:"minute",minutes:"minutes",second:"second",seconds:"seconds"},de:{no_timers:"Keine Timer",click_to_start:"Zum Starten klicken",no_active_timers:"Keine aktiven Timer",active_timers:"Aktive Timer",add:"Hinzufügen",custom:"Benutzerdefiniert",cancel:"Abbrechen",save:"Speichern",start:"Starten",snooze:"Schlummern",dismiss:"Verwerfen",ready:"Bereit",paused:"Pausiert",times_up:"Zeit abgelaufen!",timer:"Timer",hour_ago:"Stunde her",hours_ago:"Stunden her",minute_ago:"Minute her",minutes_ago:"Minuten her",second_ago:"Sekunde her",seconds_ago:"Sekunden her",h:"h",m:"m",s:"s",d:"T",w_short:"W",mo_short:"Mo",y_short:"J",day:"Tag",days:"Tage",week:"Woche",weeks:"Wochen",month:"Monat",months:"Monate",year:"Jahr",years:"Jahre",hour:"Stunde",hours:"Stunden",minute:"Minute",minutes:"Minuten",second:"Sekunde",seconds:"Sekunden"},es:{no_timers:"Sin Temporizadores",click_to_start:"Clic para iniciar",no_active_timers:"Sin Temporizadores Activos",active_timers:"Temporizadores Activos",add:"Añadir",custom:"Personalizado",cancel:"Cancelar",save:"Guardar",start:"Iniciar",snooze:"Posponer",dismiss:"Descartar",ready:"Listo",paused:"Pausado",times_up:"¡Se acabó el tiempo!",timer:"Temporizador",hour_ago:"hora atrás",hours_ago:"horas atrás",minute_ago:"minuto atrás",minutes_ago:"minutos atrás",second_ago:"segundo atrás",seconds_ago:"segundos atrás",h:"h",m:"m",s:"s",d:"d",w_short:"sem",mo_short:"mes",y_short:"a",day:"día",days:"días",week:"semana",weeks:"semanas",month:"mes",months:"meses",year:"año",years:"años",hour:"hora",hours:"horas",minute:"minuto",minutes:"minutos",second:"segundo",seconds:"segundos"},da:{no_timers:"Ingen timere",click_to_start:"Tryk for at starte",no_active_timers:"Ingen aktive timere",active_timers:"Aktive Timere",add:"Tilføj",custom:"Tilpasset",cancel:"Annuller",save:"Gem",start:"Start",snooze:"Snooze",dismiss:"Afvis",ready:"Klar",paused:"På pause",times_up:"Tid udløbet!",timer:"Timer",hour_ago:"time siden",hours_ago:"timer siden",minute_ago:"minut siden",minutes_ago:"minutter siden",second_ago:"sekund siden",seconds_ago:"sekunder siden",h:"t",m:"m",s:"s",d:"d",w_short:"u",mo_short:"må",y_short:"å",day:"dag",days:"dage",week:"uge",weeks:"uger",month:"måned",months:"måneder",year:"år",years:"år",hour:"time",hours:"timer",minute:"minut",minutes:"minutter",second:"sekund",seconds:"sekunder"}};console.info("%c SIMPLE-TIMER-CARD %c v2.1.1 ","color: white; background: #4285f4; font-weight: 700;","color: #4285f4; background: white; font-weight: 700;");class mt extends ot{static get properties(){return{hass:{},_config:{},_timers:{state:!0},_ui:{state:!0},_customSecs:{state:!0},_activeSecs:{state:!0},_editingTimerId:{state:!0},_editDuration:{state:!0}}}static getStubConfig(){return{type:"custom:simple-timer-card"}}_sanitizeText(t){if(!t||"string"!=typeof t)return"";const e=document.createElement("div");return e.textContent=t,e.textContent}_localize(t){const e=this._config?.language||"en";return ht[e]?.[t]||ht.en[t]||t}_validateAudioUrl(t){if(!t||"string"!=typeof t)return!1;try{const e=new URL(t,window.location.origin);return["https:","http:","file:"].includes(e.protocol)||t.startsWith("/local/")||t.startsWith("/hacsfiles/")}catch{return!1}}_validateStoredTimerData(t){if(!t||"object"!=typeof t)return!1;if(!Array.isArray(t.timers))return!1;for(const e of t.timers){if(!e||"object"!=typeof e)return!1;if(!e.id||"string"!=typeof e.id)return!1;if(e.label&&"string"!=typeof e.label)return!1;if(e.duration&&"number"!=typeof e.duration)return!1;if(e.end&&"number"!=typeof e.end)return!1}return!0}_validateTimerInput(t,e){return t&&("number"!=typeof t||t<=0||t>31536e6)?{valid:!1,error:"Invalid duration"}:e&&("string"!=typeof e||e.length>100)?{valid:!1,error:"Invalid label"}:{valid:!0}}constructor(){super(),this._timers=[],this._timerInterval=null,this._dismissed=new Set,this._ringingTimers=new Set,this._activeAudioInstances=new Map,this._lastActionTime=new Map,this._expirationTimes=new Map,this._lastCleanupTime=0,this._ui={noTimerHorizontalOpen:!1,noTimerVerticalOpen:!1,activeFillOpen:!1,activeBarOpen:!1},this._customSecs={horizontal:900,vertical:900},this._activeSecs={fill:600,bar:600},this._showingCustomName={},this._lastSelectedName={},this._storageNamespace="default",this._editingTimerId=null,this._editDuration={h:0,m:0,s:0}}_isActionThrottled(t,e="global",i=1e3){const s=`${t}-${e}`,r=Date.now();return r-(this._lastActionTime.get(s)||0)<i||(this._lastActionTime.set(s,r),!1)}_normalizeStringList(t,e=[]){return Array.isArray(t)?t.map(t=>String(t).trim()).filter(Boolean):"string"==typeof t?t.split(",").map(t=>t.trim()).filter(Boolean):e}_normalizeNumberList(t,e=[]){return Array.isArray(t)?t.map(t=>"number"==typeof t?t:parseFloat(String(t).trim())).filter(t=>Number.isFinite(t)):"string"==typeof t?t.split(",").map(t=>parseFloat(t.trim())).filter(t=>Number.isFinite(t)):"number"==typeof t&&Number.isFinite(t)?[t]:e}_normalizePresetList(t){const e=Array.isArray(t)?t:"string"==typeof t?t.split(","):"number"==typeof t?[t]:[],i=[];for(const t of e){if(null==t)continue;if("number"==typeof t&&Number.isFinite(t)){i.push(t);continue}const e=String(t).trim();if(!e)continue;const s=Number(e);Number.isFinite(s)&&/^-?\d+(?:\.\d+)?$/.test(e)?i.push(s):i.push(e)}return i}_normalizeConfigTypes(t){const e={...t||{}};return"string"==typeof e.entities&&(e.entities=[e.entities]),Array.isArray(e.entities)||(e.entities=[]),e.timer_name_presets=this._normalizeStringList(e.timer_name_presets,Array.isArray(e.timer_name_presets)?e.timer_name_presets:[]),e.timer_presets=this._normalizePresetList(e.timer_presets),e.minute_buttons=this._normalizeNumberList(e.minute_buttons,Array.isArray(e.minute_buttons)?e.minute_buttons:[]),e.time_format_units=this._normalizeStringList(e.time_format_units,Array.isArray(e.time_format_units)?e.time_format_units:[]),Array.isArray(e.pinned_timers)||(e.pinned_timers=[]),delete e.alexa_audio_enabled,delete e.alexa_audio_file_url,delete e.alexa_audio_repeat_count,delete e.alexa_audio_play_until_dismissed,e}setConfig(t){const e=(t=this._normalizeConfigTypes(t)).default_timer_entity&&t.default_timer_entity.startsWith("sensor."),i=e?"mqtt":"local",s={topic:"simple_timer_card/timers",state_topic:"simple_timer_card/timers/state",events_topic:"simple_timer_card/events",sensor_entity:e?t.default_timer_entity:null,...t.mqtt},r="vertical"===(t.layout||"horizontal").toLowerCase()?"vertical":"horizontal",n=["fill_vertical","fill_horizontal","bar_vertical","bar_horizontal","circle"].includes((t.style||"").toLowerCase())?(t.style||"").toLowerCase():"bar_horizontal",o=["drain","fill","milestones"].includes(t.progress_mode)?t.progress_mode:"drain";this._storageNamespace=t.storage_namespace||t.default_timer_entity||"default";const a=["days","hours","minutes","seconds"];let l=a;Array.isArray(t.time_format_units)?(l=t.time_format_units.map(t=>String(t).toLowerCase()).filter(t=>["years","months","weeks","days","hours","minutes","seconds"].includes(t)),0===l.length&&(l=a)):"string"==typeof t.time_format_units&&(l=t.time_format_units.split(",").map(t=>t.trim().toLowerCase()).filter(t=>["years","months","weeks","days","hours","minutes","seconds"].includes(t)),0===l.length&&(l=a)),this._config={layout:r,style:n,language:"en",snooze_duration:5,timer_presets:[5,15,30],timer_name_presets:[],pinned_timers:[],show_timer_presets:!0,show_active_header:!0,minute_buttons:[1,5,10],default_timer_icon:"mdi:timer-outline",default_timer_color:"var(--primary-color)",default_timer_entity:null,auto_voice_pe:!1,expire_action:"keep",expire_keep_for:120,auto_dismiss_writable:!1,audio_enabled:!1,audio_file_url:"",audio_repeat_count:1,audio_play_until_dismissed:!1,audio_completion_delay:4,expired_subtitle:null,keep_timer_visible_when_idle:!1,progress_mode:o,default_new_timer_duration_mins:15,time_format:"hms",time_format_units:l,milestone_unit:"auto",milestone_pulse:!0,...t,entities:t.entities||[],storage:i,layout:r,style:n,mqtt:s,time_format_units:l};const c=60*(parseInt(this._config.default_new_timer_duration_mins,10)||15);this._customSecs={horizontal:c,vertical:c},this._activeSecs={fill:c,bar:c},"string"==typeof this._config.timer_name_presets&&(this._config.timer_name_presets=this._config.timer_name_presets.split(",").map(t=>t.trim()).filter(t=>t))}connectedCallback(){super.connectedCallback(),this._startTimerUpdates()}disconnectedCallback(){super.disconnectedCallback(),this._stopTimerUpdates();for(const t of this._activeAudioInstances.keys())this._stopAudioForTimer(t);this._activeAudioInstances.clear(),this._ringingTimers.clear(),this._lastActionTime.clear(),this._expirationTimes.clear(),this._dismissed.clear()}_startTimerUpdates(){this._stopTimerUpdates(),this._updateTimers(),this._timerInterval=setInterval(()=>this._updateTimers(),250)}_stopTimerUpdates(){this._timerInterval&&(clearInterval(this._timerInterval),this._timerInterval=null)}_getStorageKey(){return`simple-timer-card-${this._storageNamespace}`}_loadTimersFromStorage_local(){try{const t=localStorage.getItem(this._getStorageKey());if(t){const e=JSON.parse(t);if(this._validateStoredTimerData(e))return e.timers;localStorage.removeItem(this._getStorageKey())}}catch(t){try{localStorage.removeItem(this._getStorageKey())}catch(t){}}return[]}_saveTimersToStorage_local(t){try{const e={timers:t||[],version:1,lastUpdated:Date.now()};localStorage.setItem(this._getStorageKey(),JSON.stringify(e))}catch(t){}}_updateTimerInStorage_local(t,e){const i=this._loadTimersFromStorage_local(),s=i.findIndex(e=>e.id===t);-1!==s&&(i[s]={...i[s],...e},this._saveTimersToStorage_local(i))}_removeTimerFromStorage_local(t){const e=this._loadTimersFromStorage_local().filter(e=>e.id!==t);this._saveTimersToStorage_local(e)}_loadTimersFromStorage_mqtt(){try{const t=this._config?.mqtt?.sensor_entity;if(!t)return[];const e=this.hass?.states?.[t],i=e?.attributes?.timers;return Array.isArray(i)?i:[]}catch(t){return[]}}_saveTimersToStorage_mqtt(t){try{const e={timers:t||[],version:1,lastUpdated:Date.now()};this.hass.callService("mqtt","publish",{topic:this._config?.mqtt?.topic,payload:JSON.stringify(e),retain:!0}),this.hass.callService("mqtt","publish",{topic:this._config?.mqtt?.state_topic,payload:JSON.stringify({version:e.version,t:e.lastUpdated}),retain:!0})}catch(t){}}_updateTimerInStorage_mqtt(t,e){const i=this._loadTimersFromStorage_mqtt(),s=i.findIndex(e=>e.id===t);-1!==s&&(i[s]={...i[s],...e},this._saveTimersToStorage_mqtt(i))}_removeTimerFromStorage_mqtt(t){const e=this._loadTimersFromStorage_mqtt().filter(e=>e.id!==t);this._saveTimersToStorage_mqtt(e)}_loadTimersFromStorage(t=null){const e=t||this._config.storage,i="mqtt"===e?this._loadTimersFromStorage_mqtt():"local"===e?this._loadTimersFromStorage_local():[];return Array.isArray(i)?i.map(t=>{if(!t||"object"!=typeof t)return t;const e=void 0!==t.audio_file_url||void 0!==t.audio_repeat_count||void 0!==t.audio_play_until_dismissed;if(!1===t.audio_enabled&&!e){const e={...t};return delete e.audio_enabled,e}return t}):[]}_saveTimersToStorage(t,e=null){const i=e||this._config.storage;return"mqtt"===i?this._saveTimersToStorage_mqtt(t):"local"===i?this._saveTimersToStorage_local(t):void 0}_updateTimerInStorage(t,e,i=null){const s=i||this._config.storage;return"mqtt"===s?this._updateTimerInStorage_mqtt(t,e):"local"===s?this._updateTimerInStorage_local(t,e):void 0}_removeTimerFromStorage(t,e=null){const i=e||this._config.storage;return"mqtt"===i?this._removeTimerFromStorage_mqtt(t):"local"===i?this._removeTimerFromStorage_local(t):void 0}_addTimerToStorage(t){const e=t.source||this._config.storage,i=this._loadTimersFromStorage(e);i.push(t),this._saveTimersToStorage(i,e)}_detectMode(t,e,i){if(!e)return null;if(t.startsWith("timer."))return"timer";if(t.startsWith("input_text.")||t.startsWith("text."))return"helper";const s=e.attributes||{};if(null!=s.alarms_brief||null!=s.sorted_active||null!=s.sorted_paused||null!=s.sorted_all||null!=s.next_timer||null!=s.timers||(t.includes("next_timer")||t.endsWith("_next_timer"))&&(null!=s.total_active||null!=s.total_all||null!=s.status||null!=s.timer||null!=s.dismissed))return"alexa";if("timestamp"===s.device_class)return"timestamp";const r=i?.minutes_attr;if(r&&null!==(s[r]??null))return"minutes_attr";if(s.start_time)return"timestamp";const n=e.state;return n&&"unknown"!==n&&"unavailable"!==n&&isNaN(n)&&!isNaN(Date.parse(n))?"timestamp":null}_toMs(t){if(null==t)return null;if("number"==typeof t)return t<1e3?1e3*t:t>1e12?Math.max(0,t-Date.now()):t;if("string"==typeof t){const e=Number(t);if(!Number.isNaN(e))return this._toMs(e);const i=/^P(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)$/i.exec(t.trim());if(i){return 1e3*(3600*parseInt(i[1]||"0",10)+60*parseInt(i[2]||"0",10)+parseInt(i[3]||"0",10))}}return null}_parseAlexa(t,e,i){const s=e.attributes;let r=s.sorted_active,n=s.sorted_paused,o=s.sorted_all;null==r&&null==n&&null==o&&null!=s.timers&&(o=s.timers),null==r&&null!=s.next_timer&&(r=[s.next_timer]);const a=t=>{if(Array.isArray(t))return t;if("string"==typeof t)try{return JSON.parse(t)}catch{return[]}return Array.isArray(t)?t:[]};if(r=a(r),n=a(n),o=a(o),0===r.length&&0===n.length&&s.alarms_brief){const r=s.alarms_brief,n=Array.isArray(r.active)?r.active:[];let o=Date.now();return s.process_timestamp?o=new Date(s.process_timestamp).getTime():e.last_updated&&(o=new Date(e.last_updated).getTime()),n.map(r=>{const n="PAUSED"===r.status,a=r.remainingTime||0,l=s.process_timestamp||e.last_updated?o:r.lastUpdatedDate||Date.now(),c=n?a:l+a;let d,u=r.originalDuration;if(!u)if(n)u=a;else{const t=r.lastUpdatedDate||l;u=Math.max(0,l-t)+a}if(r.timerLabel)d=this._sanitizeText(r.timerLabel);else{const t=this._cleanFriendlyName(s.friendly_name),e=i?.name||t||(n?"Alexa Timer (Paused)":"Alexa Timer");d=this._sanitizeText(e)}return{id:r.id,source:"alexa",source_entity:t,label:d,icon:i?.icon||(n?"mdi:timer-pause":"mdi:timer"),color:i?.color||(n?"var(--warning-color)":"var(--primary-color)"),end:c,duration:u,paused:n}})}const l=t=>"number"==typeof t?.originalDurationInMillis&&t.originalDurationInMillis||"number"==typeof t?.originalDurationInSeconds&&1e3*t.originalDurationInSeconds||this._toMs(t?.originalDuration)||null,c=(s,r,n)=>{const o=n?this._toMs(r?.remainingTime):null,a=n?o??0:Number(r?.triggerTime||0);let c;if(r?.timerLabel)c=this._sanitizeText(r.timerLabel);else{const t=this._cleanFriendlyName(e.attributes.friendly_name),s=i?.name||t||(n?"Alexa Timer (Paused)":"Alexa Timer"),o=l(r),a=o>0?this._formatDurationDisplay(o):"0m";c="Alexa Timer"!==s&&"Alexa Timer (Paused)"!==s?this._sanitizeText(`${s} - ${a}`):this._sanitizeText(s)}const d=!!i?.icon,u=!!i?.color;return{id:s,source:"alexa",source_entity:t,label:c,icon:d?i.icon:n?"mdi:timer-pause":"mdi:timer",color:u?i.color:n?"var(--warning-color)":"var(--primary-color)",end:a,duration:l(r),paused:!!n}},d=(t,e)=>Array.isArray(t)?t.map(t=>{let i,s;return Array.isArray(t)?[i,s]=t:(s=t,i=s.id),c(i,s,e)}):[],u=d(r,!1);let h=d(n,!0);return 0===h.length&&o.length>0&&(h=d(o,!0).filter(t=>t&&"PAUSED"===String(t.status).toUpperCase())),[...u,...h]}_parseHelper(t,e,i){try{const s=JSON.parse(e.state||"{}");if(!this._validateStoredTimerData(s))return[];if(s?.timers?.map)return s.timers.map(e=>({...e,source:"helper",source_entity:t,label:this._sanitizeText(e.label||i?.name||this._localize("timer")),icon:e.icon||i?.icon||"mdi:timer-outline",color:e.color||i?.color||"var(--primary-color)"}));if(s?.timer&&"object"==typeof s.timer){const r=s.timer;return[{end:r.e,duration:r.d,id:`single-timer-${t}`,label:this._sanitizeText(i?.name||e?.attributes?.friendly_name||this._localize("timer")),paused:!1,source:"helper",source_entity:t,icon:i?.icon||"mdi:timer-outline",color:i?.color||"var(--primary-color)"}]}return[]}catch(t){return[]}}_parseTimestamp(t,e,i){const s=e.state;if(!s||"unknown"===s||"unavailable"===s)return[];const r=Date.parse(s);if(isNaN(r))return[];let n=null;if(i?.start_time_entity){const t=this.hass.states[i.start_time_entity];if(t&&t.state&&"unknown"!==t.state&&"unavailable"!==t.state){const e=Date.parse(t.state);!isNaN(e)&&r>e&&(n=r-e)}}else{const t=i?.start_time_attr||"start_time",s=e.attributes[t];if(s){const t=Date.parse(s);!isNaN(t)&&r>t&&(n=r-t)}}return[{id:`${t}-${r}`,source:"timestamp",source_entity:t,label:i?.name||e.attributes.friendly_name||this._localize("timer"),icon:i?.icon||"mdi:timer-sand",color:i?.color||"var(--primary-color)",end:r,duration:n}]}_parseMinutesAttr(t,e,i){const s=i?.minutes_attr||"Minutes to arrival",r=Number(e?.attributes?.[s]);if(!isFinite(r))return[];const n=Date.now()+6e4*Math.max(0,r);return[{id:`${t}-eta-${Math.floor(n/1e3)}`,source:"minutes_attr",source_entity:t,label:i?.name||e.attributes.friendly_name||"ETA",icon:i?.icon||"mdi:timer-outline",color:i?.color||"var(--primary-color)",end:n,duration:6e4*r}]}_parseTimer(t,e,i){const s=e.state,r=e.attributes;if(!["active","paused","idle","finished"].includes(s))return[];let n=null,o=null,a=null;if(r.duration&&(o=this._parseHMSToMs(r.duration)),"idle"===s){const s=r.icon||"mdi:play";return[{id:t,source:"timer",source_entity:t,label:i?.name||e.attributes.friendly_name||this._localize("timer"),icon:i?.icon||s,color:i?.color||"var(--primary-color)",end:null,duration:o,paused:!1,idle:!0}]}if("finished"===s){const s=r.finishes_at?Date.parse(r.finishes_at):Date.now(),n=r.icon||"mdi:timer-check";return[{id:t,source:"timer",source_entity:t,label:i?.name||e.attributes.friendly_name||this._localize("timer"),icon:i?.icon||n,color:i?.color||"var(--success-color)",end:s,duration:o,paused:!1,finished:!0,finishedAt:s}]}if("paused"===s?r.remaining&&"0:00:00"!==r.remaining&&(a=this._parseHMSToMs(r.remaining),n=a):"active"===s&&(r.finishes_at?n=Date.parse(r.finishes_at):r.remaining&&"0:00:00"!==r.remaining&&(a=this._parseHMSToMs(r.remaining),a>0&&(n=Date.now()+a))),!n&&"idle"!==s&&"finished"!==s)return[];const l=r.icon||("paused"===s?"mdi:timer-pause":"mdi:timer");return[{id:t,source:"timer",source_entity:t,label:i?.name||e.attributes.friendly_name||this._localize("timer"),icon:i?.icon||l,color:i?.color||("paused"===s?"var(--warning-color)":"var(--primary-color)"),end:n,duration:o,paused:"paused"===s,idle:"idle"===s,finished:"finished"===s}]}_parseVoicePE(t,e,i){const s=e.state,r=e.attributes||{};if(!["active","paused","idle","finished"].includes(s))return[];const n=r.control_entity&&String(r.control_entity).trim()?String(r.control_entity).trim():null,o=r.timer_id??r.timerId??r.id??r.timer??r.voice_pe_timer_id??r.vpe_timer_id??r.uuid??null,a=o&&String(o).trim()?String(o).trim():null,l=r.duration?this._parseHMSToMs(r.duration):null,c=r.remaining?this._parseHMSToMs(r.remaining):null,d=!(!n||!a),u=r.display_name&&String(r.display_name).trim()?String(r.display_name).trim():r.friendly_name&&String(r.friendly_name).trim()?String(r.friendly_name).trim():i?.name&&String(i.name).trim()?String(i.name).trim():this._localize("timer"),h={id:a?`vpe-${a}`:t,source:"voice_pe",source_entity:t,label:u,name:u,duration:l,voice_pe_timer_id:a,control_entity:n,supports:d?{pause:!0,cancel:!0,snooze:!1,extend:!1}:{pause:!1,cancel:!1,snooze:!1,extend:!1}};if("idle"===s){const t=r.icon||"mdi:play";return[{...h,icon:i?.icon||t,color:i?.color||"var(--primary-color)",end:null,paused:!1,idle:!0,finished:!1,state:"idle"}]}if("finished"===s){const t=r.finishes_at?Date.parse(r.finishes_at):Date.now(),e=r.icon||"mdi:timer-check";return[{...h,icon:i?.icon||e,color:i?.color||"var(--success-color)",end:t,paused:!1,idle:!1,finished:!0,finishedAt:t,state:"finished"}]}let m=null,_=null;if("paused"===s?c&&c>0&&(_=c,m=_):"active"===s&&(r.finishes_at?m=Date.parse(r.finishes_at):c&&c>0&&(_=c,m=Date.now()+_)),!m)return[];const p=r.icon||("paused"===s?"mdi:timer-pause":"mdi:timer");return[{...h,icon:i?.icon||p,color:i?.color||("paused"===s?"var(--warning-color)":"var(--primary-color)"),end:m,paused:"paused"===s,idle:!1,finished:!1,state:s}]}_parseHMSToMs(t){if(!t)return 0;const e=t.split(":").map(t=>parseInt(t,10));return 3===e.length?1e3*(3600*e[0]+60*e[1]+e[2]):2===e.length?1e3*(60*e[0]+e[1]):0}_isLocalVoicePETimer(t){return"voice_pe"===t?.source&&t?.control_entity&&String(t.control_entity).trim()&&t?.voice_pe_timer_id&&String(t.voice_pe_timer_id).trim()&&!0===t.supports?.pause}async _sendVoicePECommand(t,e){if(!this.hass)return;if(!t||!e)return;const i=String(t).trim(),s=i.split(".")[0];"text"===s||"input_text"===s?await this.hass.callService(s,"set_value",{entity_id:i,value:String(e)}):this._toast("Invalid control entity for Voice PE timers.")}_getVoicePEControlEntity(t){try{const e=t?this.hass?.states?.[t]:null,i=e?.attributes?.control_entity?String(e.attributes.control_entity).trim():"";if(i)return i}catch(t){}const e=this._config?.voice_pe_control_entity?String(this._config.voice_pe_control_entity).trim():"";if(e)return e;try{const t=this.hass?.states||{},e=Object.keys(t).filter(t=>(t.startsWith("text.")||t.startsWith("input_text."))&&t.toLowerCase().includes("voice_pe_timer_command")).sort((t,e)=>t.localeCompare(e));return e.length?e[0]:null}catch(t){return null}}async _sendVoicePEStart(t,e,i){const s=Math.max(1,Math.ceil(t/1e3)),r=this._getVoicePEControlEntity(i);if(!r)return void this._toast("Voice PE control entity is missing.");let n=`start:${s}`;const o=e&&String(e).trim()?String(e).trim().replace(/:/g," "):"";o&&(n=`${n}:${o}`),await this._sendVoicePECommand(r,n)}_updateTimers(){if(!this.hass)return;this._ensureAutoVoicePEEntities();const t=[];for(const e of this._config.entities){const i="string"==typeof e?e:e.entity,s="string"==typeof e?{}:e,r=this.hass.states[i];if(!r)continue;let n=s.mode;if(n&&"auto"!==n||(n=this._detectMode(i,r,s),n))try{"alexa"===n?t.push(...this._parseAlexa(i,r,s)):"helper"===n?t.push(...this._parseHelper(i,r,s)):"timer"===n?t.push(...this._parseTimer(i,r,s)):"voice_pe"===n?t.push(...this._parseVoicePE(i,r,s)):"minutes_attr"===n?t.push(...this._parseMinutesAttr(i,r,s)):"timestamp"===n&&t.push(...this._parseTimestamp(i,r,s))}catch(t){}}"local"!==this._config.storage&&"mqtt"!==this._config.storage||t.push(...this._loadTimersFromStorage());const e=t.filter(t=>!this._dismissed.has(`${t.source_entity}:${t.id}`)),i=Date.now();this._timers=e.map(t=>{const e=i,s="number"==typeof t.duration?t.duration:0,r="number"==typeof t.end_ts?t.end_ts:t.paused||"number"!=typeof t.end?null:t.end,n="number"==typeof t.start_ts?t.start_ts:r&&s?r-s:null;let o;o="template"===t.kind||t.idle?s:t.finished?0:t.paused?"number"==typeof t.remaining_ms?t.remaining_ms:"number"==typeof t.end?t.end:0:r?Math.max(0,r-e):0;const a=t.state||(t.finished?"finished":t.idle?"idle":t.paused?"paused":o<=0?"expired":"active"),l=t.supports||{pause:["helper","local","mqtt","timer"].includes(t.source),cancel:["helper","local","mqtt","timer","alexa"].includes(t.source),snooze:["helper","local","mqtt","timer","alexa"].includes(t.source),extend:["helper","local","mqtt","timer"].includes(t.source)},c=s&&o>=0?Math.max(0,Math.min(100,(s-o)/s*100)):0;return{...t,name:t.name||t.label,duration_ms:s,start_ts:n,end_ts:r,remaining_ms:o,state:a,supports:l,remaining:o,percent:c}}).sort((t,e)=>{if(t.finished&&!e.finished)return 1;if(!t.finished&&e.finished)return-1;const i=Number(t.remaining_ms??t.remaining??0),s=Number(e.remaining_ms??e.remaining??0);return(isFinite(i)?i:Number.MAX_SAFE_INTEGER)-(isFinite(s)?s:Number.MAX_SAFE_INTEGER)});for(const t of this._timers){const e=this._ringingTimers.has(t.id);"timer"===t.source&&t.idle&&e&&(t.idle=!1,t.remaining=0);const i=t.remaining<=0&&!t.paused&&!t.idle;i&&!e?(this._ringingTimers.add(t.id),this._playAudioNotification(t.id,t),this._publishTimerEvent("expired",t)):!i&&e&&(this._ringingTimers.delete(t.id),this._stopAudioForTimer(t.id))}const s=new Set(this._timers.map(t=>t.id));for(const t of this._ringingTimers)s.has(t)||(this._ringingTimers.delete(t),this._stopAudioForTimer(t));const r=Date.now(),n=1e3*(this._config.audio_completion_delay||4);for(const t of[...this._timers]){if(t.idle||t.remaining>0||t.paused)continue;const e=this._config.expire_action;if("dismiss"!==e){if("keep"===e){const e=["helper","local","mqtt"].includes(t.source);let i;e?(t.expiredAt||(t.expiredAt=r,this._updateTimerInStorage(t.id,{expiredAt:r},t.source)),i=t.expiredAt):(this._expirationTimes.has(t.id)||this._expirationTimes.set(t.id,r),i=this._expirationTimes.get(t.id));r-i>=1e3*(parseInt(this._config.expire_keep_for,10)||120)&&(t._isBeingRemoved||(t._isBeingRemoved=!0,this._handleDismiss(t),e||this._expirationTimes.delete(t.id)));continue}if("remove"===e){const e=this._getEntityConfig(t.source_entity);let i;if(i=!t||!0!==t.audio_enabled&&!1!==t.audio_enabled?e&&void 0!==e.audio_enabled?!0===e.audio_enabled:!0===this._config.audio_enabled:!0===t.audio_enabled,!t._isBeingRemoved){t._isBeingRemoved=!0;const e=()=>this._handleDismiss(t);i?setTimeout(e,n):e()}}}}const o=new Set(this._timers.map(t=>t.id));for(const t of this._expirationTimes.keys())o.has(t)||this._expirationTimes.delete(t);for(const[t,e]of this._activeAudioInstances.entries())this._ringingTimers.has(t)||this._stopAudioForTimer(t);(!this._lastCleanupTime||Date.now()-this._lastCleanupTime>1e4)&&(this._cleanupThrottleMap(),this._lastCleanupTime=Date.now())}_playAudioNotification(t,e){const i=e?.source_entity||e?.entity_id||e?.id||null,s=this._getEntityConfig(i),r=e&&(!0===e.audio_enabled||!1===e.audio_enabled||void 0!==e.audio_file_url||void 0!==e.audio_repeat_count||void 0!==e.audio_play_until_dismissed),n=s&&(void 0!==s.audio_enabled||void 0!==s.audio_file_url||void 0!==s.audio_repeat_count||void 0!==s.audio_play_until_dismissed);let o,a,l,c;if(r?(o=!1!==e.audio_enabled&&!0===e.audio_enabled,a=e.audio_file_url,l=e.audio_repeat_count,c=e.audio_play_until_dismissed):n?(o=s.audio_enabled,a=s.audio_file_url,l=s.audio_repeat_count,c=s.audio_play_until_dismissed):(o=this._config.audio_enabled,a=this._config.audio_file_url,l=this._config.audio_repeat_count,c=this._config.audio_play_until_dismissed),o&&a&&this._validateAudioUrl(a)){this._stopAudioForTimer(t);try{const e=new Audio(a);let i=0;const s=c?1/0:Math.max(1,Math.min(10,l||1)),r=()=>{this._ringingTimers.has(t)&&i<s?(i++,e.currentTime=0,e.play().catch(()=>{})):this._stopAudioForTimer(t)},n={audio:e,playNext:r};e.addEventListener("ended",r),e.addEventListener("error",()=>this._stopAudioForTimer(t)),this._activeAudioInstances.set(t,n),r()}catch(t){}}}_stopAudioForTimer(t){const e=this._activeAudioInstances.get(t);if(e){const{audio:i,playNext:s}=e;i.removeEventListener("ended",s),i.pause(),i.currentTime=0,i.src="",this._activeAudioInstances.delete(t)}}_cleanupThrottleMap(){const t=Date.now();for(const[e,i]of this._lastActionTime.entries())t-i>6e4&&this._lastActionTime.delete(e)}_discoverVoicePEEntities(){try{const t=this.hass?.states||{},e=[];for(const[i,s]of Object.entries(t)){if(!i||!s)continue;const t=s.state;if(!["active","paused","idle","finished"].includes(t))continue;const r=s.attributes||{};(r.control_entity?String(r.control_entity).trim():"")&&e.push(i)}return e.sort((t,e)=>t.localeCompare(e)),e}catch(t){return[]}}_getDefaultVoicePETargetEntity(){try{const t=Array.isArray(this._config?.entities)?this._config.entities:[];for(const e of t){const t="string"==typeof e?e:e?.entity,i="string"==typeof e?null:e?.mode;if(!t)continue;if("voice_pe"===i||t.startsWith("sensor.")&&String(t).toLowerCase().includes("vpe_timer"))return t;const s=this.hass?.states?.[t];if(s?.attributes?.control_entity?String(s.attributes.control_entity).trim():"")return t}}catch(t){}const t=this._discoverVoicePEEntities();return t.length?t[0]:null}_ensureAutoVoicePEEntities(){if(this._autoVoicePEInjected)return;if(!0!==this._config?.auto_voice_pe)return;if((Array.isArray(this._config?.entities)?this._config.entities:[]).length>0)return void(this._autoVoicePEInjected=!0);const t=this._discoverVoicePEEntities();t.length&&(this._config.entities=t.map(t=>({entity:t,mode:"voice_pe"})),this._autoVoicePEInjected=!0)}_publishTimerEvent(t,e){if("mqtt"===this._config.storage||this._config.default_timer_entity?.startsWith("sensor.")){const i={id:e.id,label:e.label,name:e.name,source:e.source,source_entity:e.source_entity,icon:e.icon,color:e.color,voice_pe_timer_id:e.voice_pe_timer_id,control_entity:e.control_entity,timestamp:Date.now(),event:t,duration:e.duration,remaining:e.remaining};e?.pinned_id&&(i.pinned_id=e.pinned_id),"voice_pe"===e?.source&&(i.state=e.state,i.start_ts=e.start_ts,i.end_ts=e.end_ts,i.duration_ms=e.duration_ms??e.duration,i.remaining_ms=e.remaining_ms??e.remaining),this.hass.callService("mqtt","publish",{topic:`${this._config?.mqtt?.events_topic||"simple_timer_card/events"}/${t}`,payload:JSON.stringify(i),retain:!1})}}_getEntityConfig(t){if(!t||!this._config.entities)return null;for(const e of this._config.entities){if(("string"==typeof e?e:e?.entity)===t)return"string"==typeof e?{}:e}return null}_parseDuration(t){if(!t)return 0;if(/^\d{1,2}:\d{2}:\d{2}$/.test(t))return this._parseHMSToMs(t);if(/^\d{1,2}:\d{2}$/.test(t)){const e=t.split(":").map(t=>parseInt(t,10));return 1e3*(60*e[0]+e[1])}let e=0;const i=t.match(/(\d+)\s*h/),s=t.match(/(\d+)\s*m/),r=t.match(/(\d+)\s*s/),n=t.match(/^\d+$/);return i&&(e+=3600*parseInt(i[1])),s&&(e+=60*parseInt(s[1])),r&&(e+=parseInt(r[1])),i||s||r||!n||(e=60*parseInt(n[0])),1e3*e}_mutateHelper(t,e){const i=this.hass.states[t]?.state??'{"timers":[]}';let s;try{s=JSON.parse(i),this._validateStoredTimerData(s)||(s={timers:[]})}catch{s={timers:[]}}Array.isArray(s.timers)||(s.timers=[]),e(s);const r=t.split(".")[0];this.hass.callService(r,"set_value",{entity_id:t,value:JSON.stringify({...s,version:1})})}_handleCreateTimer(t){const e=t.target,i=e.querySelector('ha-textfield[name="duration"]')?.value?.trim()??"",s=e.querySelector('ha-textfield[name="label"]')?.value?.trim()??"",r=e.querySelector('[name="target_entity"]')?.value??"",n=this._parseDuration(i);let o=r;if(o||(o=this._config.default_timer_entity||""),!0===this._config.auto_voice_pe){const t=this._getDefaultVoicePETargetEntity();t&&(o=t)}if(n<=0)return;if(!this._validateTimerInput(n,s).valid)return;const a=Date.now()+n,l={id:`custom-${Date.now()}`,label:this._sanitizeText(s||this._localize("timer")),icon:this._config.default_timer_icon||"mdi:timer-outline",color:this._config.default_timer_color||"var(--primary-color)",end:a,duration:n,source:"helper",paused:!1};if(o){if(this._getVoicePEControlEntity(o))return this._publishTimerEvent("started",{source:"voice_pe",source_entity:o,label:l.label}),this._sendVoicePEStart(n,"",o),void this.requestUpdate()}if(!o){const t=Date.now(),e={id:l.id,kind:"active",label:l.label,name:l.label,source:"mqtt"===this._config.storage?"mqtt":"local",source_entity:"mqtt"===this._config.storage?this._config.mqtt?.sensor_entity:"local",start_ts:t,end_ts:t+n,state:"active",supports:{pause:!0,cancel:!0,snooze:!0,extend:!0},icon:l.icon,color:l.color,end:t+n,duration:n,paused:!1,idle:!1,finished:!1};return this._addTimerToStorage(e),this._publishTimerEvent("started",e),void this.requestUpdate()}this._mutateHelper(o,t=>{t.timers.push(l)}),this._publishTimerEvent("started",l)}_parseDurationInputToMs(t){if(null==t)return null;if("number"==typeof t)return!Number.isFinite(t)||t<=0?null:Math.round(6e4*t);const e=String(t).trim().toLowerCase().match(/^(\d+)\s*([smhd])?$/);if(!e)return null;const i=parseInt(e[1],10);if(!Number.isFinite(i)||i<=0)return null;const s=e[2]||"m";return"s"===s?1e3*i:"m"===s?6e4*i:"h"===s?36e5*i:"d"===s?864e5*i:null}_createPresetTimer(t,e=null,i={}){const s=this._parseDurationInputToMs(t);if(!s)return;const r=i.label||(()=>{const e="string"==typeof t?t.trim().toLowerCase():t;if("string"==typeof e&&e.endsWith("s")){return`${parseInt(e.slice(0,-1),10)}s ${this._localize("timer")}`}if("string"==typeof e&&e.endsWith("h")){return`${parseInt(e.slice(0,-1),10)}${this._localize("h")} ${this._localize("timer")}`}if("string"==typeof e&&e.endsWith("d")){return`${parseInt(e.slice(0,-1),10)}${this._localize("d")} ${this._localize("timer")}`}const i="string"==typeof e&&e.endsWith("m")?parseInt(e.slice(0,-1),10):parseInt(e,10);return!isNaN(i)&&i>0?this._formatTimerLabel(60*i):this._formatTimerLabel(Math.round(s/1e3))})();let n=e;n||!0!==this._config.auto_voice_pe||(n=this._getDefaultVoicePETargetEntity()),n||(n=this._config.default_timer_entity);const o=!0===this._config.auto_voice_pe,a=this._config?.voice_pe_control_entity?String(this._config.voice_pe_control_entity).trim():"",l=o&&!!a;if(o&&!a&&this._toast("Voice PE control entity is not set. Please configure it in the card editor."),l){const t=!(!i?.voice_pe_name||!String(i.voice_pe_name).trim())?String(i.voice_pe_name).trim():"";return this._publishTimerEvent("started",{source:"voice_pe",source_entity:n,label:r}),this._sendVoicePEStart(s,t,n),void this.requestUpdate()}const c=Date.now(),d={id:i.id||`preset-${c}`,kind:"active",label:r,name:r,source:"local",source_entity:n||"local",start_ts:c,end_ts:c+s,state:"active",supports:{pause:!0,cancel:!0,snooze:!0,extend:!0},pinned_id:i.pinned_id,expired_subtitle:i.expired_subtitle??this._config.expired_subtitle,...void 0!==i.audio_enabled?{audio_enabled:i.audio_enabled}:{},...void 0!==i.audio_file_url?{audio_file_url:i.audio_file_url}:{},...void 0!==i.audio_repeat_count?{audio_repeat_count:i.audio_repeat_count}:{},...void 0!==i.audio_play_until_dismissed?{audio_play_until_dismissed:i.audio_play_until_dismissed}:{},icon:i.icon||this._config.default_timer_icon||"mdi:timer-outline",color:i.color||this._config.default_timer_color||"var(--primary-color)",end:c+s,duration:s,paused:!1,idle:!1,finished:!1};if(n&&(n.startsWith("input_text.")||n.startsWith("text."))){if(d.source="helper",d.source_entity=n,resolvedTargetEntity){if(this._getVoicePEControlEntity(resolvedTargetEntity))return this._publishTimerEvent("started",{source:"voice_pe",source_entity:resolvedTargetEntity,label:d.label}),this._sendVoicePEStart(s,"",resolvedTargetEntity),void this.requestUpdate()}this._mutateHelper(resolvedTargetEntity,t=>{t.timers.push(d)}),this._publishTimerEvent("created",d)}else"mqtt"===this._config.storage?(d.source="mqtt",d.source_entity=this._config.mqtt.sensor_entity,this._addTimerToStorage(d),this._publishTimerEvent("created",d)):(d.source="local",d.source_entity="mqtt"===this._config.storage?this._config.mqtt.sensor_entity:"local",this._addTimerToStorage(d),this._publishTimerEvent("created",d));this._publishTimerEvent("started",d),this.requestUpdate()}_formatTimerLabel(t){if(t<=0)return this._localize("timer");const e=this._localize("timer"),i=this._localize("h"),s=this._localize("m"),r=this._localize("s"),n=this._localize("d");if(t<60)return`${t}${r} ${e}`;const o=Math.floor(t/ut),a=t%ut;if(o>0&&0===a)return`${o}${n} ${e}`;const l=Math.floor(a/dt),c=Math.floor(a%dt/60),d=a%60,u=[];return o&&u.push(`${o}${n}`),l&&u.push(`${l}${i}`),c&&u.push(`${c}${s}`),d&&u.length<3&&u.push(`${d}${r}`),`${u.join("")} ${e}`}_formatDurationDisplay(t){if(t<=0)return`0${this._localize("s")}`;const e=Math.floor(t/1e3);if(e<60)return`${e}${this._localize("s")}`;const i=Math.floor(e/60),s=e%60;if(e<3600)return`${i}${this._localize("m")}${s?s+this._localize("s"):""}`;const r=i%60;return`${Math.floor(i/60)}${this._localize("h")}${r?r+this._localize("m"):""}`}_renderTimerNameSelector(t,e){const i=this._config.timer_name_presets||[];if(0===i.length)return H`<input id="${t}" class="text-input" placeholder="${e}" style="margin-top: 12px;" />`;const s=this._lastSelectedName[t],r=s&&!i.includes(s);return H`
      <div class="name-selector">
        <div class="name-chips" style="display: ${this._showingCustomName[t]?"none":"flex"};">
          ${i.map(e=>H`
            <button class="btn btn-preset ${this._lastSelectedName[t]===e?"selected":""}"
                    @click=${i=>this._setTimerName(t,e,i)}>
              ${this._sanitizeText(e)}
            </button>
          `)}
          ${r?H`
            <button class="btn btn-preset selected"
                    @click=${e=>this._editCustomValue(t,e)}>
              ${this._sanitizeText(s)}
            </button>
          `:H`
            <button class="btn btn-ghost"
                    @click=${e=>this._showCustomNameInput(t,e)}>
              ${this._localize("custom")}
            </button>
          `}
        </div>
        <input id="${t}" class="text-input" placeholder="${e}"
               style="display: ${this._showingCustomName[t]?"block":"none"};"
               @blur=${e=>this._handleCustomInputBlur(t,e)}
               @keypress=${e=>"Enter"===e.key&&this._handleCustomInputBlur(t,e)} />
      </div>
    `}_setTimerName(t,e,i){i?.stopPropagation();const s=this.shadowRoot?.getElementById(t);s&&(s.value=e,this._lastSelectedName[t]=e,this._showingCustomName[t]=!1,this.requestUpdate())}_showCustomNameInput(t,e){e?.stopPropagation();const i=this.shadowRoot?.getElementById(t);i&&(i.value="",this._showingCustomName[t]=!0,this.requestUpdate(),setTimeout(()=>i.focus(),10))}_editCustomValue(t,e){e?.stopPropagation();const i=this.shadowRoot?.getElementById(t);i&&(i.value=this._lastSelectedName[t]||"",this._showingCustomName[t]=!0,this.requestUpdate(),setTimeout(()=>{i.focus(),i.select()},10))}_handleCustomInputBlur(t,e){const i=e.target.value.trim();i?(this._lastSelectedName[t]=i,this._showingCustomName[t]=!1):(this._showingCustomName[t]=!1,this._lastSelectedName[t]=null),this.requestUpdate()}_cleanFriendlyName(t){return t?t.replace(/\s*next\s+timer\s*/i,"").trim():t}_handleStart(t){if("template"!==t?.kind)if("timer"===t.source)if(this._publishTimerEvent("started",t),t.duration){const e=Math.ceil(t.duration/1e3),i=this._formatDurationForService(e);this.hass.callService("timer","start",{entity_id:t.source_entity,duration:i})}else this.hass.callService("timer","start",{entity_id:t.source_entity});else this._toast("This timer can't be started from here.");else{if(this._isActionThrottled("start_template",t.pinned_id||t.id,500))return;this._createPresetTimer(t.template_preset??t.duration_input??t.preset??t.duration,null,(()=>{const e={label:t.label||t.name,voice_pe_name:t.label||t.name,icon:t.icon,color:t.color,expired_subtitle:t.expired_subtitle,pinned_id:t.pinned_id||t.id};return!0!==t.audio_enabled&&!1!==t.audio_enabled||(e.audio_enabled=t.audio_enabled),t.audio_file_url&&(e.audio_file_url=t.audio_file_url),void 0!==t.audio_repeat_count&&(e.audio_repeat_count=t.audio_repeat_count),!0!==t.audio_play_until_dismissed&&!1!==t.audio_play_until_dismissed||(e.audio_play_until_dismissed=t.audio_play_until_dismissed),e})())}}_handleCancel(t){if(!this._isActionThrottled("cancel",t.id)){if(this._ringingTimers.delete(t.id),"voice_pe"===t.source)return this._isLocalVoicePETimer(t)?(this._publishTimerEvent("cancelled",t),void this._sendVoicePECommand(t.control_entity,`cancel:${String(t.voice_pe_timer_id).trim()}`)):void this._toast("This timer is read only.");this._publishTimerEvent("cancelled",t),"helper"===t.source?this._mutateHelper(t.source_entity,e=>{e.timers=e.timers.filter(e=>e.id!==t.id)}):["local","mqtt"].includes(t.source)?(this._removeTimerFromStorage(t.id,t.source),this.requestUpdate()):"timer"===t.source?this.hass.callService("timer","cancel",{entity_id:t.source_entity}):this._toast("This timer can't be cancelled from here.")}}_handlePause(t){if("voice_pe"===t.source)return this._isLocalVoicePETimer(t)?(this._publishTimerEvent("paused",t),void this._sendVoicePECommand(t.control_entity,`pause:${String(t.voice_pe_timer_id).trim()}`)):void this._toast("This timer is read only.");if(this._publishTimerEvent("paused",t),"helper"===t.source){const e=t.remaining;this._mutateHelper(t.source_entity,i=>{const s=i.timers.findIndex(e=>e.id===t.id);-1!==s&&(i.timers[s].paused=!0,i.timers[s].end=e)})}else if(["local","mqtt"].includes(t.source)){const e=t.remaining;this._updateTimerInStorage(t.id,{paused:!0,end:e},t.source),this.requestUpdate()}else"timer"===t.source?this.hass.callService("timer","pause",{entity_id:t.source_entity}):this._toast("This timer can't be paused from here.")}_handleResume(t){if("voice_pe"===t.source)return this._isLocalVoicePETimer(t)?(this._publishTimerEvent("resumed",t),void this._sendVoicePECommand(t.control_entity,`resume:${String(t.voice_pe_timer_id).trim()}`)):void this._toast("This timer is read only.");if(this._publishTimerEvent("resumed",t),"helper"===t.source){const e=Date.now()+t.remaining;this._mutateHelper(t.source_entity,i=>{const s=i.timers.findIndex(e=>e.id===t.id);-1!==s&&(i.timers[s].paused=!1,i.timers[s].end=e)})}else if(["local","mqtt"].includes(t.source)){const e=Date.now()+t.remaining;this._updateTimerInStorage(t.id,{paused:!1,end:e},t.source),this.requestUpdate()}else"timer"===t.source?this.hass.callService("timer","start",{entity_id:t.source_entity}):this._toast("This timer can't be resumed from here.")}_togglePause(t,e){e?.stopPropagation?.(),["helper","local","mqtt","timer"].includes(t.source)&&(t.paused?this._handleResume(t):this._handlePause(t))}_handleDismiss(t){this._ringingTimers.delete(t.id),this._stopAudioForTimer(t.id),"helper"===t.source?this._mutateHelper(t.source_entity,e=>{e.timers=e.timers.filter(e=>e.id!==t.id)}):["local","mqtt"].includes(t.source)?(this._removeTimerFromStorage(t.id,t.source),this.requestUpdate()):"timer"===t.source?this.hass.callService("timer","finish",{entity_id:t.source_entity}):(this._dismissed.add(`${t.source_entity}:${t.id}`),this.requestUpdate())}_handleSnooze(t){if(this._isActionThrottled("snooze",t.id))return;this._ringingTimers.delete(t.id),this._stopAudioForTimer(t.id),this._publishTimerEvent("snoozed",t);const e=Number(this._config.snooze_duration??5);if(!Number.isFinite(e)||e<=0)return void this._toast("Invalid snooze_duration setting.");const i=6e4*e,s=Date.now()+i;if("helper"===t.source){const e=Date.now();this._mutateHelper(t.source_entity,r=>{const n=r.timers.findIndex(e=>e.id===t.id);-1!==n&&(r.timers[n].start_ts=e,r.timers[n].end_ts=s,r.timers[n].end=s,r.timers[n].duration=i,r.timers[n].paused=!1,r.timers[n].state="active")})}else if(["local","mqtt"].includes(t.source)){const e=Date.now();this._updateTimerInStorage(t.id,{start_ts:e,end_ts:s,end:s,duration:i,paused:!1,state:"active"},t.source),this.requestUpdate()}else if("timer"===t.source){const i=this._formatDurationForService(60*e);this.hass.callService("timer","start",{entity_id:t.source_entity,duration:i})}else this._toast("Only helper, local, MQTT, and timer entities can be snoozed here.")}_formatTimeAgo(t){if(t<1e3)return null;const e=Math.floor(t/1e3),i=Math.floor(e/60),s=Math.floor(i/60);return s>0?1===s?`1 ${this._localize("hour_ago")}`:`${s} ${this._localize("hours_ago")}`:i>0?1===i?`1 ${this._localize("minute_ago")}`:`${i} ${this._localize("minutes_ago")}`:1===e?`1 ${this._localize("second_ago")}`:`${e} ${this._localize("seconds_ago")}`}_formatClock(t,e=!1){if(t<=0)return"00:00";const i=Math.floor(t/ut),s=t%ut,r=Math.floor(s/dt),n=Math.floor(s%dt/60),o=s%60,a=(t,e=2)=>String(t).padStart(e,"0");if(e)return i>0?`${a(i)}:${a(r)}:${a(n)}:${a(o)}`:r>0?`${a(r)}:${a(n)}:${a(o)}`:`${a(n)}:${a(o)}`;const l=24*i+r;return l>0?`${a(l)}:${a(n)}:${a(o)}`:`${a(n)}:${a(o)}`}_getUnitLabel(t,e,i){if("compact"===i)return"year"===t||"years"===t?this._localize("y_short"):"month"===t||"months"===t?this._localize("mo_short"):"week"===t||"weeks"===t?this._localize("w_short"):"day"===t||"days"===t?this._localize("d"):"hour"===t||"hours"===t?this._localize("h"):"minute"===t||"minutes"===t?this._localize("m"):this._localize("s");return`${e} ${this._localize(t)}`}_formatDuration(t,e="seconds"){let i;if("ms"===e){if(t<=0)return"00:00";i=Math.ceil(t/1e3)}else{if(t<=0)return"00:00";i=Math.floor(t)}return this._formatClock(i,!1)}_formatDurationHM(t){const e=Math.ceil(t/1e3);if(e<=0)return"00";const i=Math.floor(e/3600),s=Math.floor(e%3600/60),r=t=>String(t).padStart(2,"0");return i>0?`${r(i)}:${r(s)}`:`${r(s)}`}_formatDurationSS(t){return t<=0?"0":`${Math.ceil(t/1e3)}`}_formatDurationDHMS(t){return this._formatClock(Math.ceil(t/1e3),!0)}_formatHumanUnits(t,e){const i=this._config.time_format_units&&this._config.time_format_units.length?this._config.time_format_units:["days","hours","minutes","seconds"],s={years:ct,months:2592e6,weeks:6048e5,days:lt,hours:36e5,minutes:6e4,seconds:1e3};let r=t;const n=[];for(const t of i){const o=s[t];if(!o)continue;const a=Math.floor(r/o);if(a>0||t===i[i.length-1]&&0===n.length){r-=a*o;const i=1===a?t.slice(0,-1):t,s=this._getUnitLabel(i,a,"natural"===e?"short":e);n.push("compact"===e?`${a}${s}`:`${s}`)}}return"compact"===e?n.join(" "):n.join(", ")}_formatTimeString(t){const e=this._config.time_format;return"dhms"===e?this._formatDurationDHMS(t.remaining):"hm"===e?this._formatDurationHM(t.remaining):"ss"===e?this._formatDurationSS(t.remaining):"human_compact"===e?this._formatHumanUnits(t.remaining,"compact"):"human_short"===e?this._formatHumanUnits(t.remaining,"short"):"human_natural"===e?this._formatHumanUnits(t.remaining,"natural"):this._formatDurationHMS(t.remaining)}_formatDurationHMS(t){return this._formatClock(Math.ceil(t/1e3),!1)}_formatDurationForService(t){t=Math.max(0,Math.floor(t));const e=Math.floor(t/3600),i=Math.floor(t%3600/60),s=t%60,r=t=>String(t).padStart(2,"0");return`${r(e)}:${r(i)}:${r(s)}`}_toggleCustom(t){const e=`noTimer${t.charAt(0).toUpperCase()+t.slice(1)}Open`;this._ui[e]=!this._ui[e],this.requestUpdate()}_parseAdjustmentToSeconds(t){let e=0;if("string"==typeof t&&t.toLowerCase().endsWith("s")){const i=parseInt(t.slice(0,-1),10);isNaN(i)||(e=i)}else{const i=parseInt(t,10);isNaN(i)||(e=60*i)}return e}_adjust(t,e,i=1){const s=this._parseAdjustmentToSeconds(e);this._customSecs={...this._customSecs,[t]:Math.max(0,this._customSecs[t]+i*s)}}_createAndSaveTimer(t,e){if(this._isActionThrottled("create_timer","global",500))return;if(t<=0)return;if(!this._validateTimerInput(1e3*t,e).valid)return;const i=e&&e.trim()?this._sanitizeText(e.trim()):this._formatTimerLabel(t),s={id:`custom-${Date.now()}`,label:i,icon:this._config.default_timer_icon||"mdi:timer-outline",color:this._config.default_timer_color||"var(--primary-color)",end:Date.now()+1e3*t,duration:1e3*t,paused:!1};let r=this._config.default_timer_entity;if(!0===this._config.auto_voice_pe){const t=this._getDefaultVoicePETargetEntity();t&&(r=t)}if(!!this._getVoicePEControlEntity(r)){const i=!(!e||!String(e).trim())?String(e).trim():"";return this._sendVoicePEStart(1e3*t,i,r),void this.requestUpdate()}if(r&&(r.startsWith("input_text.")||r.startsWith("text."))){if(s.source="helper",s.source_entity=r,resolvedTargetEntity){if(this._getVoicePEControlEntity(resolvedTargetEntity))return this._publishTimerEvent("started",{source:"voice_pe",source_entity:resolvedTargetEntity,label:s.label}),this._sendVoicePEStart(durationMs,"",resolvedTargetEntity),void this.requestUpdate()}this._mutateHelper(resolvedTargetEntity,t=>{t.timers.push(s)}),this._publishTimerEvent("started",s)}else s.source=this._config.storage,s.source_entity="mqtt"===this._config.storage?this._config.mqtt.sensor_entity:"local",this._addTimerToStorage(s),this._publishTimerEvent("started",s)}_startFromCustom(t,e){const i=this._customSecs[t],s="horizontal"===t?"nt-h-name":"nt-v-name";let r=e||this._lastSelectedName[s]||"";const n=this.shadowRoot?.getElementById(s);n&&n.value&&(r=n.value.trim()),this._createAndSaveTimer(i,r);const o=60*(parseInt(this._config.default_new_timer_duration_mins,10)||15);this._customSecs={...this._customSecs,[t]:o};const a=`noTimer${t.charAt(0).toUpperCase()+t.slice(1)}Open`;this._ui[a]=!1,this._showingCustomName[s]=!1,this._lastSelectedName[s]=null,n&&(n.value=""),this.requestUpdate()}_startActive(t,e){const i=this._activeSecs[t],s="bar"===t?"add-bar-name":"add-fill-name";let r=e||this._lastSelectedName[s]||"";const n=this.shadowRoot?.getElementById(s);n&&n.value&&(r=n.value.trim()),this._createAndSaveTimer(i,r);const o=60*(parseInt(this._config.default_new_timer_duration_mins,10)||15);this._activeSecs={...this._activeSecs,[t]:o};const a=`active${t.charAt(0).toUpperCase()+t.slice(1)}Open`;this._ui[a]=!1,this._showingCustomName[s]=!1,this._lastSelectedName[s]=null,n&&(n.value=""),this.requestUpdate()}_toggleActivePicker(t){const e=`active${t.charAt(0).toUpperCase()+t.slice(1)}Open`;this._ui[e]=!this._ui[e],this.requestUpdate()}_adjustActive(t,e,i=1){const s=this._parseAdjustmentToSeconds(e);this._activeSecs={...this._activeSecs,[t]:Math.max(0,this._activeSecs[t]+i*s)}}_pickAutoMilestoneUnit(t){return!t||t<=0?"seconds":t>=ct?"years":t>=2592e6?"months":t>=6048e5?"weeks":t>=lt?"days":t>=36e5?"hours":t>=6e4?"minutes":"seconds"}_renderMilestoneSegments(t,e){if("milestones"!==this._config.progress_mode)return null;if(!["bar_horizontal","bar_vertical"].includes(this._config.style))return null;const i=(this._config.milestone_unit||"auto").toLowerCase(),s="auto"===i?this._pickAutoMilestoneUnit(t.duration):i;if("none"===s)return null;const r={years:ct,months:2592e6,weeks:6048e5,days:lt,hours:36e5,minutes:6e4,seconds:1e3}[s];if(!r||!t.duration||t.duration<=0)return null;const n=Math.min(100,Math.max(1,Math.ceil(t.duration/r)));if(!n||n<=1)return null;const o=e/100*n,a=Math.floor(o),l=Math.min(n-1,Math.max(0,a)),c=!0===t.idle;return H`
      <div class="milestone-track ${c?"idle":""}">
        ${Array.from({length:n}).map((e,i)=>{if(c)return H`<div class="segment idle"></div>`;const s=i<a,r=!t.paused&&!t.idle&&!1!==this._config.milestone_pulse,n=["segment",s?"completed":"",i===l&&r?"active":"",i>a?"inactive":"","drain"===this._config.progress_mode?"drain":"fill"].join(" ");return H`<div class="${n}"></div>`})}
      </div>
    `}_renderProgressTrack(t,e,i,s){const r=this._renderMilestoneSegments(t,i);return r||H`
      <div class="track">
        <div class="fill" style="width:${"drain"===this._config.progress_mode?s:i}%"></div>
      </div>
    `}_openTimerEditor(t){if("timer"!==t.source)return;const e=t.duration||0,i=Math.floor(e/1e3);this._editDuration={h:Math.floor(i/3600),m:Math.floor(i%3600/60),s:i%60},this._editingTimerId=t.id,this.requestUpdate()}_cancelEdit(){this._editingTimerId=null,this.requestUpdate()}_adjustEditTotal(t){let e=3600*this._editDuration.h+60*this._editDuration.m+this._editDuration.s;e+=t,e<0&&(e=0),this._editDuration={h:Math.floor(e/3600),m:Math.floor(e%3600/60),s:e%60},this.requestUpdate()}async _saveTimerConfig(t){const{h:e,m:i,s:s}=this._editDuration,r=`${String(e).padStart(2,"0")}:${String(i).padStart(2,"0")}:${String(s).padStart(2,"0")}`,n=this.hass.states[t.source_entity],o=n.attributes.friendly_name||t.source_entity;try{await this.hass.callWS({type:"timer/update",timer_id:t.source_entity.replace("timer.",""),duration:r,name:o,icon:n.attributes.icon||""})}catch(t){throw console.error("Error updating timer",t),this._toast(`Error: ${t.message}`),t}}async _startEditTimer(t){try{await this._saveTimerConfig(t);const{h:e,m:i,s:s}=this._editDuration,r=`${String(e).padStart(2,"0")}:${String(i).padStart(2,"0")}:${String(s).padStart(2,"0")}`;this.hass.callService("timer","start",{entity_id:t.source_entity,duration:r}),this._editingTimerId=null,this.requestUpdate()}catch(t){}}async _saveAndClose(t){await this._saveTimerConfig(t),this._editingTimerId=null,this.requestUpdate()}_renderInlineEditor(t,e){const i="circle"===e,s=e.startsWith("fill_")?"card item editor-row":i?"item vtile editor-row":"item bar editor-row",r=this._config.minute_buttons?.length?this._config.minute_buttons:[1,5,10],n=3600*this._editDuration.h+60*this._editDuration.m+this._editDuration.s,o=t.source_entity?this.hass.states[t.source_entity]:null,a=o?.attributes?.friendly_name||t.label||t.source_entity||"",l=t=>r.map(e=>{const i=this._parseAdjustmentToSeconds(e),s=t<0,r=!s||n>=i,o="string"==typeof e&&e.toLowerCase().endsWith("s")?e.toLowerCase():`${e}${this._localize("m")}`;return H`
        <button class="btn btn-ghost ${r?"":"disabled"}"
                @click=${()=>r&&this._adjustEditTotal(t*i)}>
          ${s?"-":"+"}${o}
        </button>
      `});return H`
      <li class="${s}" style="--tcolor:${t.color||"var(--primary-color)"}; cursor: default;">
        <div class="editor-container">
          <div class="buttons-grid">
            ${l(1)}
          </div>

          <div class="display">${this._formatDuration(n,"seconds")}</div>

          <div class="buttons-grid">
            ${l(-1)}
          </div>

          <input class="text-input" placeholder="Timer Name (Optional)" readonly style="margin-top: 12px;"
                 .value=${this._sanitizeText(a)} />

          <div class="picker-actions">
            <button class="btn btn-ghost" @click=${()=>this._cancelEdit()}>${this._localize("cancel")}</button>
            <button class="btn btn-ghost" @click=${()=>this._saveAndClose(t)}>${this._localize("save")}</button>
            <button class="btn btn-primary" @click=${()=>this._startEditTimer(t)}>${this._localize("start")}</button>
          </div>
        </div>
      </li>
    `}_renderItem(t,e){if(this._editingTimerId===t.id)return this._renderInlineEditor(t,e);const i=this._getTimerRenderState(t,e),{isPaused:s,isIdle:r,isFinished:n,color:o,icon:a,ring:l,pct:c,pctLeft:d,isCircleStyle:u,isFillStyle:h,supportsPause:m,supportsManualControls:_,timeStr:p,circleValues:g,supportsReadOnlyDismiss:f}=i,v=h?"card item":u?"item vtile":"item bar",y=h?"card item finished":u?"item vtile":"card item bar",b=!t.idle&&!t.paused&&!t.finished,$="timer"===t.source&&!b;if(l)return u?H`
          <li class="${y}" style="--tcolor:${o}">
            <div class="vcol">
              <div class="vcircle-wrap">
                <svg class="vcircle" width="64" height="64" viewBox="0 0 64" aria-hidden="true">
                  <circle class="vc-track ${"drain"===this._config.progress_mode?"vc-track-drain":""}" style="stroke: var(--tcolor, var(--primary-color)); stroke-opacity: 0.22;"
                          cx="32" cy="32" r="${g.radius}"></circle>
                  <circle class="vc-prog ${"drain"===this._config.progress_mode?"vc-prog-drain done":"done"}"
                          cx="32" cy="32" r="${g.radius}"
                    stroke-dasharray="${g.circumference} ${g.circumference}"
                    style="stroke: var(--tcolor, var(--primary-color)); stroke-dashoffset: ${"drain"===this._config.progress_mode?g.circumference:"0"};
                            transition: stroke-dashoffset 0.25s;"></circle>
                </svg>
                <div class="icon-wrap xl"><ha-icon .icon=${a}></ha-icon></div>
              </div>
              <div class="vtitle">${t.label}</div>
              <div class="vstatus up">${p}</div>
              <div class="vactions">
                ${_?H`
                  <button class="chip" @click=${()=>this._handleSnooze(t)}>${this._localize("snooze")}</button>
                  <button class="chip" @click=${()=>this._handleDismiss(t)}>${this._localize("dismiss")}</button>
                `:f?H`
                  <button class="chip" @click=${()=>this._handleDismiss(t)}>${this._localize("dismiss")}</button>
                `:""}
              </div>
            </div>
          </li>
        `:H`
        <li class="${y}" style="--tcolor:${o}">
          ${h?H`<div class="progress-fill" style="width:100%"></div>`:""}
          <div class="${h?"card-content":"row"}">
            <div class="icon-wrap"><ha-icon .icon=${a}></ha-icon></div>
            <div class="info">
              <div class="title">${t.label}</div>
              <div class="status up">${p}</div>
            </div>
            ${_?H`
              <div class="chips">
                <button class="chip" @click=${()=>this._handleSnooze(t)}>${this._localize("snooze")}</button>
                <button class="chip" @click=${()=>this._handleDismiss(t)}>${this._localize("dismiss")}</button>
              </div>
            `:f?H`
              <div class="chips">
                <button class="chip" @click=${()=>this._handleDismiss(t)}>${this._localize("dismiss")}</button>
              </div>
            `:""}
          </div>
        </li>
      `;const x=$?()=>this._openTimerEditor(t):null,w=$?"cursor: pointer;":"",T="drain"===this._config.progress_mode?d:c;return h?H`
        <li class="${v}" style="--tcolor:${o}; ${w}" @click=${x}>
          <div class="progress-fill" style="${`width:${T}%;`}"></div>
          <div class="card-content">
            <div class="icon-wrap"><ha-icon .icon=${a}></ha-icon></div>
            <div class="info">
              <div class="title">${t.label}</div>
              <div class="status">${p}</div>
            </div>
            <div class="actions" @click=${t=>t.stopPropagation()}>
              ${r&&_?H`
                <button class="action-btn" title="${this._localize("start")}" @click=${()=>this._handleStart(t)}>
                  <ha-icon icon="mdi:play"></ha-icon>
                </button>
              `:m&&!l&&_?H`
                <button class="action-btn" title="${t.paused?"Resume":"Pause"}" @click=${()=>t.paused?this._handleResume(t):this._handlePause(t)}>
                  <ha-icon icon=${t.paused?"mdi:play":"mdi:pause"}></ha-icon>
                </button>
              `:""}
              ${_&&!r?H`<button class="action-btn" title="${this._localize("cancel")}" @click=${()=>this._handleCancel(t)}><ha-icon icon="mdi:close"></ha-icon></button>`:""}
            </div>
          </div>
        </li>
      `:u?H`
        <li class="${v}" style="--tcolor:${o}; ${w}" @click=${x}>
          ${_&&!r?H`
            <button class="vtile-close" title="${this._localize("cancel")}"
              @click=${e=>{e.stopPropagation(),this._handleCancel(t)}}>
              <ha-icon icon="mdi:close"></ha-icon>
            </button>
          `:""}
          <div class="vcol">
            <div class="vcircle-wrap"
                 title="${r?"Start":t.paused?"Resume":"Pause"}"
                 @click=${e=>{e.stopPropagation(),r&&_?this._handleStart(t):m&&_&&this._togglePause(t,e)}}>
              <svg class="vcircle" width="64" height="64" viewBox="0 0 64" aria-hidden="true">
                <circle class="vc-track ${"drain"===this._config.progress_mode?"vc-track-drain":""}" style="stroke: var(--tcolor, var(--primary-color)); stroke-opacity: 0.22;"
                        cx="32" cy="32" r="${g.radius}"></circle>
                <circle class="vc-prog ${"drain"===this._config.progress_mode?"vc-prog-drain":""}"
                        cx="32" cy="32" r="${g.radius}"
                  stroke-dasharray="${g.circumference} ${g.circumference}"
                  style="stroke: var(--tcolor, var(--primary-color)); stroke-dashoffset: ${g.strokeDashoffset}; transition: stroke-dashoffset 0.25s;"></circle>
              </svg>
              <div class="icon-wrap xl"><ha-icon .icon=${a}></ha-icon></div>
            </div>
            <div class="vtitle">${t.label}</div>
            <div class="vstatus">${p}</div>
          </div>
        </li>
      `:H`
        <li class="${v}" style="--tcolor:${o}; ${w}" @click=${x}>
          <div class="row">
            <div class="icon-wrap"><ha-icon .icon=${a}></ha-icon></div>
            <div class="info">
              <div class="top">
                <div class="title">${t.label}</div>
                <div class="status">${p}</div>
              </div>
              ${this._renderProgressTrack(t,e,c,d)}
            </div>
            <div class="actions" @click=${t=>t.stopPropagation()}>
              ${r&&_?H`
                <button class="action-btn" title="${this._localize("start")}" @click=${()=>this._handleStart(t)}>
                  <ha-icon icon="mdi:play"></ha-icon>
                </button>
              `:m&&!l&&_?H`
                <button class="action-btn" title="${t.paused?"Resume":"Pause"}" @click=${()=>t.paused?this._handleResume(t):this._handlePause(t)}>
                  <ha-icon icon=${t.paused?"mdi:play":"mdi:pause"}></ha-icon>
                </button>
              `:""}
              ${_&&!r?H`<button class="action-btn" title="${this._localize("cancel")}" @click=${()=>this._handleCancel(t)}><ha-icon icon="mdi:close"></ha-icon></button>`:""}
            </div>
          </div>
        </li>
      `}_calculateCircleValues(t=28,e=0,i="fill"){const s=2*t*Math.PI;return{radius:t,circumference:s,strokeDashoffset:"drain"===i?e/100*s:s-e/100*s}}_getTimerRenderState(t,e){const i=t.paused,s=t.idle,r=t.finished,n=i?"var(--warning-color)":r?"var(--success-color)":t.color||"var(--primary-color)",o=s?t.icon||"mdi:timer-outline":i?"mdi:timer-pause":r?"mdi:timer-check":t.icon||"mdi:timer-outline",a=t.remaining<=0&&!s&&!r,l="number"==typeof t.percent?Math.max(0,Math.min(100,t.percent)):0,c=100-l,d="circle"===e,u=e.startsWith("fill_"),h=["helper","local","mqtt","timer"].includes(t.source)||"voice_pe"===t.source&&!!(t.control_entity&&String(t.control_entity).trim()&&t.voice_pe_timer_id&&String(t.voice_pe_timer_id).trim()),m=this._getEntityConfig(t.source_entity),_=!0===m?.hide_timer_actions,p="timer"===t.source,g=(["local","mqtt","timer","helper"].includes(t.source)||"template"===t.kind||"template"===t.source)&&!(p&&_)||"voice_pe"===t.source&&!(!t.control_entity||!String(t.control_entity).trim()),f=a&&["timestamp","minutes_attr","alexa"].includes(t.source);let v,y;if(s)v=t.duration?this._formatDuration(t.duration,"ms"):this._localize("ready");else if(i)v=`${this._formatDuration(t.remaining,"ms")} (${this._localize("paused")})`;else if(r){const e=Date.now(),i=e-(t.finishedAt||t.end||e),s=this._formatTimeAgo(i),r=t.expired_subtitle||m?.expired_subtitle||this._config.expired_subtitle||this._localize("times_up");v=s?`${r} - ${s}`:r}else v=a?t.expired_subtitle||m?.expired_subtitle||this._config.expired_subtitle||this._localize("times_up"):this._formatTimeString(t);if(d){const t="drain"===this._config.progress_mode?"drain":"fill";y=this._calculateCircleValues(28,l,t)}return{isPaused:i,isIdle:s,isFinished:r,color:n,icon:o,ring:a,pct:l,pctLeft:c,isCircleStyle:d,isFillStyle:u,supportsPause:h,supportsManualControls:g,timeStr:v,circleValues:y,supportsReadOnlyDismiss:f}}_renderMinuteButtons(t,e,i){const s=this._config.minute_buttons?.length?this._config.minute_buttons:[1,5,10],r=["horizontal","vertical"].includes(t)?"custom":"active",n="horizontal"===t?"horizontal":"vertical"===t?"vertical":"fill"===t?"fill":"bar",o=this[`_${r}Secs`][n];return s.map(t=>{const s=this._parseAdjustmentToSeconds(t),r=i<0,a=!r||o>=s,l="string"==typeof t&&t.toLowerCase().endsWith("s")?t.toLowerCase():`${t}${this._localize("m")}`;return H`
        <button class="btn btn-ghost ${a?"":"disabled"}"
                @click=${()=>a&&e(n,t,i)}>
          ${r?"-":"+"}${l}
        </button>
      `})}_renderItemVertical(t,e){if(this._editingTimerId===t.id)return this._renderInlineEditor(t,e);const i=this._getTimerRenderState(t,e),{isPaused:s,isIdle:r,isFinished:n,color:o,icon:a,ring:l,pct:c,pctLeft:d,isCircleStyle:u,isFillStyle:h,supportsPause:m,supportsManualControls:_,timeStr:p,circleValues:g,supportsReadOnlyDismiss:f}=i,v=e.startsWith("fill_")?"card item vtile":"item vtile",y=!t.idle&&!t.paused&&!t.finished,b="timer"===t.source&&!y,$=b?()=>this._openTimerEditor(t):null,x=b?"cursor: pointer;":"",w=`width:${"drain"===this._config.progress_mode?d:c}%;`;return l?H`
        <li class="${v}" style="--tcolor:${o}">
          ${e.startsWith("fill_")?H`<div class="progress-fill" style="width:100%"></div>`:""}
          <div class="vcol">
            <div class="icon-wrap large"><ha-icon .icon=${a}></ha-icon></div>
            <div class="vtitle">${t.label}</div>
            <div class="vstatus up">${p}</div>
            <div class="vactions-center">
              ${_?H`
                <button class="chip" @click=${()=>this._handleSnooze(t)}>${this._localize("snooze")}</button>
                <button class="chip" @click=${()=>this._handleDismiss(t)}>${this._localize("dismiss")}</button>
              `:f?H`
                <button class="chip" @click=${()=>this._handleDismiss(t)}>${this._localize("dismiss")}</button>
              `:""}
            </div>
          </div>
        </li>
      `:"circle"===e?H`
        <li class="${v}" style="--tcolor:${o}; ${x}" @click=${$}>
          ${_&&!r?H`
            <button class="vtile-close" title="${this._localize("cancel")}"
              @click=${e=>{e.stopPropagation(),this._handleCancel(t)}}>
              <ha-icon icon="mdi:close"></ha-icon>
            </button>
          `:""}
          <div class="vcol">
            <div class="vcircle-wrap"
                 title="${r?"Start":t.paused?"Resume":"Pause"}"
                 @click=${e=>{e.stopPropagation(),b?this._openTimerEditor(t):r&&_?this._handleStart(t):m&&_&&this._togglePause(t,e)}}>
              <svg class="vcircle" width="64" height="64" viewBox="0 0 64" aria-hidden="true">
                <circle class="vc-track ${"drain"===this._config.progress_mode?"vc-track-drain":""}"
                        cx="32" cy="32" r="${g.radius}"></circle>
                <circle class="vc-prog ${"drain"===this._config.progress_mode?"vc-prog-drain":""}"
                        cx="32" cy="32" r="${g.radius}"
                  stroke-dasharray="${g.circumference} ${g.circumference}"
                  style="stroke-dashoffset: ${g.strokeDashoffset}; transition: stroke-dashoffset 0.25s;"></circle>
              </svg>
              <div class="icon-wrap xl"><ha-icon .icon=${a}></ha-icon></div>
            </div>
            <div class="vtitle">${t.label}</div>
            <div class="vstatus">${p}</div>
          </div>
        </li>
      `:H`
      <li class="${v}" style="--tcolor:${o}; ${x}" @click=${$}>
        ${e.startsWith("fill_")?H`<div class="progress-fill" style="${w}"></div>`:""}
        <div class="vcol">
          <div class="icon-wrap large"><ha-icon .icon=${a}></ha-icon></div>
          <div class="vtitle">${t.label}</div>
          <div class="vstatus">${p}</div>
          ${e.startsWith("bar_")?H`
            <div class="vprogressbar" @click=${t=>t.stopPropagation()}>
              ${r&&_?H`
                <button class="action-btn" title="${this._localize("start")}" @click=${()=>this._handleStart(t)}>
                  <ha-icon icon="mdi:play"></ha-icon>
                </button>
              `:m&&_?H`
                <button class="action-btn"
                  title="${t.paused?"Resume":"Pause"}"
                  @click=${()=>t.paused?this._handleResume(t):this._handlePause(t)}>
                  <ha-icon icon=${t.paused?"mdi:play":"mdi:pause"}></ha-icon>
                </button>
              `:""}
              ${this._renderMilestoneSegments(t,c)||H`
                <div class="vtrack small">
                  <div class="vfill" style="width:${"drain"===this._config.progress_mode?d:c}%"></div>
                </div>
              `}
              ${_&&!r?H`
                <button class="action-btn" title="${this._localize("cancel")}" @click=${()=>this._handleCancel(t)}>
                  <ha-icon icon="mdi:close"></ha-icon>
                </button>
              `:""}
            </div>
          `:H`

            <div class="vactions" @click=${t=>t.stopPropagation()}>
              ${r&&_?H`
                <button class="action-btn" title="${this._localize("start")}" @click=${()=>this._handleStart(t)}>
                  <ha-icon icon="mdi:play"></ha-icon>
                </button>
              `:m&&_?H`
                <button class="action-btn"
                  title="${t.paused?"Resume":"Pause"}"
                  @click=${()=>t.paused?this._handleResume(t):this._handlePause(t)}>
                  <ha-icon icon=${t.paused?"mdi:play":"mdi:pause"}></ha-icon>
                </button>
              `:""}
              ${_&&!r?H`
                <button class="action-btn" title="${this._localize("cancel")}" @click=${()=>this._handleCancel(t)}>
                  <ha-icon icon="mdi:close"></ha-icon>
                </button>
              `:""}
            </div>
          `}
        </div>
      </li>
    `}_getPinnedTimers(){const t=Array.isArray(this._config?.pinned_timers)?this._config.pinned_timers:[];return 0===t.length?[]:t.map((t,e)=>{const i=t&&"object"==typeof t?t.duration??t.preset??t.minutes??t.secs:t,s=this._parseDurationInputToMs(i);if(!s)return null;const r=t&&"object"==typeof t&&t.name?t.name:`#${e+1}`,n=t&&"object"==typeof t&&t.icon?t.icon:this._config.default_timer_icon||"mdi:timer-outline",o=t&&"object"==typeof t&&t.color?t.color:this._config.default_timer_color||"var(--primary-color)";return{id:`pinned-${e}`,pinned_id:t&&"object"==typeof t&&t.id?t.id:`pinned-${e}`,kind:"template",name:r,label:r,source:"template",source_entity:null,start_ts:null,end_ts:null,state:"idle",supports:{pause:!1,cancel:!1,snooze:!1,extend:!1},template_preset:i,duration_input:i,icon:n,color:o,expired_subtitle:t&&"object"==typeof t&&t.expired_subtitle?t.expired_subtitle:this._config.expired_subtitle||"",audio_enabled:!(!t||"object"!=typeof t||!0!==t.audio_enabled)||void 0,audio_file_url:t&&"object"==typeof t&&t.audio_file_url?t.audio_file_url:void 0,audio_repeat_count:t&&"object"==typeof t&&null!=t.audio_repeat_count?t.audio_repeat_count:void 0,audio_play_until_dismissed:!(!t||"object"!=typeof t||!0!==t.audio_play_until_dismissed)||void 0,duration:s,end:s,paused:!1,idle:!0,finished:!1,duration_ms:s,remaining_ms:s,remaining:s,percent:0}}).filter(Boolean)}render(){if(!this._config)return H``;const t=!1===this._config.show_timer_presets?[]:this._config.timer_presets?.length?this._config.timer_presets:[5,15,30],e=this._timers.filter(t=>{if(t.idle&&"voice_pe"===t.source)return!1;if(t.idle&&"timer"===t.source){const e=this._getEntityConfig(t.source_entity);if(!(!0===e?.keep_timer_visible_when_idle))return!1}return!0}),i=this._getPinnedTimers().filter(t=>!e.some(e=>e.pinned_id&&t.pinned_id&&e.pinned_id===t.pinned_id)),s=[...i,...e].sort((t,e)=>{if(t.finished&&!e.finished)return 1;if(!t.finished&&e.finished)return-1;const i=Number(t.remaining_ms??t.remaining??0),s=Number(e.remaining_ms??e.remaining??0);return(isFinite(i)?i:Number.MAX_SAFE_INTEGER)-(isFinite(s)?s:Number.MAX_SAFE_INTEGER)}),r=this._config.layout,n=this._config.style,o=["fill_vertical","bar_vertical","circle"].includes((this._config.style||"").toLowerCase())?"vertical":"horizontal",a=!1!==this._config.show_timer_presets&&!1!==this._config.show_active_header,l="horizontal"===r?H`
      <div class="card nt-h ${this._ui.noTimerHorizontalOpen?"expanded":""}">
        <div class="row">
          <div class="card-content" @click=${!1===this._config.show_timer_presets?()=>this._toggleCustom("horizontal"):null}>
            <div class="icon-wrap"><ha-icon icon="mdi:timer-off"></ha-icon></div>
            <div>
              <p class="nt-title">${this._localize("no_timers")}</p>
              <p class="nt-sub">${this._localize("click_to_start")}</p>
            </div>
          </div>
          <div style="display:flex; gap:8px;">
            ${t.map(t=>{const e="string"==typeof t&&t.toLowerCase().endsWith("s")?t.toLowerCase():`${t}${this._localize("m")}`;return H`<button class="btn btn-preset" @click=${()=>this._createPresetTimer(t)}>${e}</button>`})}
            ${!1===this._config.show_timer_presets?H`
              <button class="btn btn-ghost" @click=${()=>this._toggleCustom("horizontal")}><ha-icon icon="mdi:plus" style="--mdc-icon-size:16px;"></ha-icon> ${this._localize("add")}</button>
            `:H`
              <button class="btn btn-ghost" @click=${()=>this._toggleCustom("horizontal")}>${this._localize("custom")}</button>
            `}
          </div>
        </div>
        <div class="picker">
          <div class="buttons-grid">
            ${this._renderMinuteButtons("horizontal",(t,e,i)=>this._adjust(t,e,i),1)}
          </div>
          <div class="display">${this._formatDuration(this._customSecs.horizontal,"seconds")}</div>
          <div class="buttons-grid">
            ${this._renderMinuteButtons("horizontal",(t,e,i)=>this._adjust(t,e,i),-1)}
          </div>
          ${this._renderTimerNameSelector("nt-h-name","Timer Name (Optional)")}

          <div class="picker-actions">
            <button class="btn btn-ghost" @click=${()=>this._ui.noTimerHorizontalOpen=!1}>${this._localize("cancel")}</button>
            <button class="btn btn-primary" @click=${()=>this._startFromCustom("horizontal")}>${this._localize("start")}</button>
          </div>
        </div>
      </div>
    `:H`
      <div class="card nt-v ${this._ui.noTimerVerticalOpen?"expanded":""}">
        <div class="col">
          <div class="card-content" style="flex-direction:column;justify-content:center;gap:8px;flex:1;" @click=${!1===this._config.show_timer_presets?()=>this._toggleCustom("vertical"):null}>
            <div class="icon-wrap"><ha-icon icon="mdi:timer-off"></ha-icon></div>
            <p class="nt-title">${this._localize("no_active_timers")}</p>
          </div>
          <div style="display:flex; gap:8px; margin-bottom:8px;">
            ${t.map(t=>{const e="string"==typeof t&&t.toLowerCase().endsWith("s")?t.toLowerCase():`${t}${this._localize("m")}`;return H`<button class="btn btn-preset" @click=${()=>this._createPresetTimer(t)}>${e}</button>`})}
            ${!1===this._config.show_timer_presets?H`
              <button class="btn btn-ghost" @click=${()=>this._toggleCustom("vertical")}><ha-icon icon="mdi:plus" style="--mdc-icon-size:16px;"></ha-icon> ${this._localize("add")}</button>
            `:H`
              <button class="btn btn-ghost" @click=${()=>this._toggleCustom("vertical")}>${this._localize("custom")}</button>
            `}
          </div>
        </div>
        <div class="picker">
          <div class="buttons-grid">
            ${this._renderMinuteButtons("vertical",(t,e,i)=>this._adjust(t,e,i),1)}
          </div>
          <div class="display">${this._formatDuration(this._customSecs.vertical,"seconds")}</div>
          <div class="buttons-grid">
            ${this._renderMinuteButtons("vertical",(t,e,i)=>this._adjust(t,e,i),-1)}
          </div>
          ${this._renderTimerNameSelector("nt-v-name","Timer Name (Optional)")}
          <div class="picker-actions">
            <button class="btn btn-ghost" @click=${()=>this._ui.noTimerVerticalOpen=!1}>${this._localize("cancel")}</button>
            <button class="btn btn-primary" @click=${()=>this._startFromCustom("vertical")}>${this._localize("start")}</button>
          </div>
        </div>
      </div>
    `,c="vertical"===o?this._renderItemVertical.bind(this):this._renderItem.bind(this),d="vertical"===o||"circle"===n,u=d&&s.length>1?2:1,h=d?`list vgrid cols-${u}`:"list",m=n.startsWith("fill_")?H`
      <div class="card ${this._ui.activeFillOpen?"card-show":""}">
        ${!1!==this._config.show_active_header?H`
          <div class="active-head">
            <h4>${this._localize("active_timers")}</h4>
            ${a?H`
              <div class="header-actions">
                ${t.map(t=>{const e="string"==typeof t&&t.toLowerCase().endsWith("s")?t.toLowerCase():`${t}${this._localize("m")}`;return H`<button class="btn btn-preset" @click=${()=>this._createPresetTimer(t)}>${e}</button>`})}
                <button class="btn btn-ghost" @click=${()=>this._toggleActivePicker("fill")}>${this._localize("custom")}</button>
              </div>
            `:H`
              <button class="btn btn-add" @click=${()=>this._toggleActivePicker("fill")}><ha-icon icon="mdi:plus" style="--mdc-icon-size:16px;"></ha-icon> ${this._localize("add")}</button>
            `}
          </div>
        `:""}
        <div class="active-picker">
          <div class="buttons-grid">
            ${this._renderMinuteButtons("fill",(t,e,i)=>this._adjustActive(t,e,i),1)}
          </div>
          <div class="display">${this._formatDuration(this._activeSecs.fill,"seconds")}</div>
          <div class="buttons-grid">
            ${this._renderMinuteButtons("fill",(t,e,i)=>this._adjustActive(t,e,i),-1)}
          </div>
          ${this._renderTimerNameSelector("add-fill-name","Timer Name (Optional)")}
          <div class="picker-actions">
            <button class="btn btn-ghost" @click=${()=>this._ui.activeFillOpen=!1}>${this._localize("cancel")}</button>
            <button class="btn btn-primary" @click=${()=>this._startActive("fill")}>${this._localize("start")}</button>
          </div>
        </div>
        <ul class="${h}">
          ${s.map(t=>c(t,n))}
        </ul>
      </div>
    `:H`
      <div class="card ${this._ui.activeBarOpen?"card-show":""}">
        ${!1!==this._config.show_active_header?H`
          <div class="active-head">
            <h4>${this._localize("active_timers")}</h4>
            ${a?H`
              <div class="header-actions">
                ${t.map(t=>{const e="string"==typeof t&&t.toLowerCase().endsWith("s")?t.toLowerCase():`${t}${this._localize("m")}`;return H`<button class="btn btn-preset" @click=${()=>this._createPresetTimer(t)}>${e}</button>`})}
                <button class="btn btn-ghost" @click=${()=>this._toggleActivePicker("bar")}>${this._localize("custom")}</button>
              </div>
            `:H`
              <button class="btn btn-add" @click=${()=>this._toggleActivePicker("bar")}><ha-icon icon="mdi:plus" style="--mdc-icon-size:16px;"></ha-icon> ${this._localize("add")}</button>
            `}
          </div>
        `:""}
        <div class="active-picker">
          <div class="buttons-grid">
            ${this._renderMinuteButtons("bar",(t,e,i)=>this._adjustActive(t,e,i),1)}
          </div>
          <div class="display">${this._formatDuration(this._activeSecs.bar,"seconds")}</div>
          <div class="buttons-grid">
            ${this._renderMinuteButtons("bar",(t,e,i)=>this._adjustActive(t,e,i),-1)}
          </div>
          ${this._renderTimerNameSelector("add-bar-name","Timer Name (Optional)")}
          <div class="picker-actions">
            <button class="btn btn-ghost" @click=${()=>this._ui.activeBarOpen=!1}>${this._localize("cancel")}</button>
            <button class="btn btn-primary" @click=${()=>this._startActive("bar")}>${this._localize("start")}</button>
          </div>
        </div>
        <ul class="${h}">
          ${s.map(t=>c(t,n))}
        </ul>
      </div>
    `;return H`
      <ha-card>
        ${this._config.title?H`<div class="card-header"><span>${this._config.title}</span></div>`:""}
        ${0===s.length?H`<div class="grid"><div>${l}</div></div>`:H`<div class="grid"><div>${m}</div></div>`}
      </ha-card>
    `}static get styles(){return n`
      :host { --stc-chip-radius: 9999px; }
      ha-card { border-radius: var(--ha-card-border-radius, 12px); overflow: hidden; padding: 0; background: var(--ha-card-background, var(--card-background-color)); }
      .grid { display: grid; grid-template-columns: 1fr; gap: 12px; padding: 0; margin: -1px 0; }
      .card { background: transparent; position: relative; padding: 0 8px; box-sizing: border-box; }
      .card-content { position: relative; z-index: 1; display: flex; align-items: center; gap: 12px; padding: 0 4px; height: 40px; }
      .progress-fill { position: absolute; inset: 6px 0; height: auto; width: 0; left: 0; z-index: 0; transition: width 1s linear; background: var(--tcolor, var(--primary-color)); opacity: 0.25; border-radius: inherit; }
      .card.finished .progress-fill { width: 100% !important; }
      .nt-h { padding: 0 8px; min-height: 56px; transition: height .3s ease; }
      .nt-h.expanded { height: auto; }
      .nt-h .row { display: flex; align-items: center; justify-content: space-between; min-height: 56px; }
      .nt-v { padding: 0 8px; min-height: 120px; transition: height .3s ease; }
      .nt-v.expanded { height: auto; }
      .nt-v .col { display: flex; flex-direction: column; align-items: center; justify-content: space-between; width: 100%; min-height: 120px; }
      .picker, .active-picker { max-height: 0; opacity: 0; overflow: hidden; transition: max-height .5s ease, opacity .3s ease, padding-top .5s ease, margin-bottom .3s ease; padding-top: 0; margin-bottom: 0; }
      .card.expanded .picker { max-height: 450px; opacity: 1; padding: 12px 8px 8px; }
      .card-show .active-picker { max-height: 450px; opacity: 1; margin-bottom: 8px; padding: 8px 0; }
      .icon-wrap { width: 36px; height: 36px; border-radius: var(--ha-card-border-radius, 50%); background: color-mix(in srgb, var(--tcolor, var(--primary-color)) 18%, var(--ha-card-background, var(--card-background-color))); display: flex; align-items: center; justify-content: center; flex: 0 0 36px; }
      .icon-wrap ha-icon { --mdc-icon-size: 22px; color: var(--tcolor, var(--primary-color)); }
      .nt-title { margin: 0; font-size: 14px; font-weight: 500; line-height: 20px; }
      .nt-sub { margin: 0; font-size: 12px; color: var(--secondary-text-color); line-height: 16px; }
      .btn { font-weight: 600; border-radius: var(--stc-chip-radius); padding: 6px 10px; font-size: 12px; border: none; cursor: pointer; }
      .btn.disabled { opacity: 0.5; pointer-events: none; }
      .btn-preset { background: var(--secondary-background-color, rgba(0,0,0,.08)); color: var(--primary-text-color); }
      .btn-ghost { background: var(--card-background-color); border: 1px solid var(--divider-color); color: var(--primary-text-color); }
      .btn-primary { background: var(--primary-color); color: var(--text-primary-color, #fff); }
      .btn-add { display: flex; align-items: center; gap: 8px; background: var(--secondary-background-color, rgba(0,0,0,.08)); color: var(--secondary-text-color); }
      .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; max-width: 220px; margin: 0 auto; }
      .buttons-grid { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; width: 100%; box-sizing: border-box; }
      .buttons-grid .btn { flex: 0 0 auto; min-width: 68px; }
      .display { text-align: center; font-size: 36px; font-weight: 700; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; margin: 8px 0; }
      .picker-actions { display: flex; gap: 12px; width: 100%; margin: 16px auto 0; box-sizing: border-box; }
      .picker-actions .btn { flex: 1; }
      .text-input { width: 90%; text-align: center; padding: 8px 12px; font-size: 14px; border-radius: var(--stc-chip-radius); color: var(--primary-text-color); background: var(--card-background-color); border: 1px solid var(--divider-color); outline: none; margin: 0 auto; display: block; }
      .text-input::placeholder { color: var(--secondary-text-color); }
      .name-selector { display: flex; flex-direction: column; gap: 8px; width: 100%; padding-top: 12px; position: relative; transition: all 0.3s ease; }
      .name-chips { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; animation: fadeIn 0.3s ease; }
      @keyframes fadeIn { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }
      .active-head { display: flex; align-items: center; justify-content: space-between; padding-top: 8px; margin-bottom: 6px; flex-wrap: wrap; gap: 8px; }
      .active-head h4 { margin: 0; font-size: 16px; font-weight: 600; color: var(--primary-text-color); }
      .header-actions { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
      .list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
      .item { box-sizing: border-box; position: relative; border-radius: var(--ha-card-border-radius, 12px); overflow: hidden; padding: 8px 0; min-height: 56px; background: var(--stc-item-background, transparent); }
      .item .info { display: flex; flex-direction: column; justify-content: center; height: 36px; flex: 1; overflow: hidden; }
      .item .title { font-size: 14px; font-weight: 500; line-height: 20px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .item .status { font-size: 12px; color: var(--secondary-text-color); line-height: 16px; font-variant-numeric: tabular-nums; }
      .item .status.editable { cursor: pointer; text-decoration: underline; text-decoration-style: dotted; text-underline-offset: 3px; }
      .item .status.up { color: color-mix(in srgb, var(--tcolor, var(--primary-color)) 70%, white); }
      .item .actions { display: flex; gap: 4px; align-items: center; height: 36px; }
      .item .action-btn { color: var(--secondary-text-color); background: none; border: 0; padding: 4px; cursor: pointer; border-radius: 50%; transition: all 0.2s; }
      .bar .row { display: flex; align-items: center; gap: 12px; height: 40px; }
      .bar .top { display: flex; align-items: center; justify-content: space-between; height: 18px; }
      .track { width: 100%; height: 8px; border-radius: var(--stc-chip-radius); background: color-mix(in srgb, var(--tcolor, var(--primary-color)) 10%, transparent); margin-top: 2px; overflow: hidden; }
      .fill { height: 100%; width: 0%; border-radius: var(--stc-chip-radius); background: var(--tcolor, var(--primary-color)); transition: width 1s linear; }
      .chip { font-weight: 600; color: color-mix(in srgb, var(--tcolor, var(--primary-color)) 70%, white); border-radius: var(--stc-chip-radius); padding: 4px 8px; font-size: 12px; background: none; border: 1px solid color-mix(in srgb, var(--tcolor, var(--primary-color)) 20%, transparent); cursor: pointer; }
      .chip:hover { background: color-mix(in srgb, var(--tcolor, var(--primary-color)) 18%, var(--ha-card-background, var(--card-background-color))); }
      .vgrid { display: grid; gap: 8px; padding: 0px; }
      .vgrid.cols-1 { grid-template-columns: 1fr; }
      .vgrid.cols-2 { grid-template-columns: 1fr 1fr; }
      .vtile { position: relative; min-height: 120px; display: flex; align-items: center; justify-content: center; box-sizing: border-box; }
      .vtile .vcol { z-index: 1; width: 100%; display: flex; flex-direction: column; align-items: center; gap: 4px; text-align: center; }
      .vtile-close { position: absolute; top: 4px; right: 4px; border: 0; background: none; padding: 4px; border-radius: 50%; color: var(--secondary-text-color); cursor: pointer; z-index: 3; }
      .vtile-close:hover { background: color-mix(in srgb, var(--primary-color) 10%, transparent); }
      .icon-wrap.large { width: 36px; height: 36px; flex: 0 0 36px; border-radius: var(--ha-card-border-radius, 50%); background: color-mix(in srgb, var(--tcolor, var(--primary-color)) 18%, var(--ha-card-background, var(--card-background-color))); display: flex; align-items: center; justify-content: center; }
      .vtitle { font-size: 14px; font-weight: 600; line-height: 16px; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin: 0; }
      .vstatus { font-size: 12px; color: var(--secondary-text-color); line-height: 14px; font-variant-numeric: tabular-nums; margin: 0; margin-bottom: 2px; }
      .vstatus.editable { cursor: pointer; text-decoration: underline; text-decoration-style: dotted; text-underline-offset: 3px; }
      .vstatus.up { color: color-mix(in srgb, var(--tcolor, var(--primary-color)) 70%, white); }
      .vtrack.small { flex: 0 0 60%; height: 6px; border-radius: var(--stc-chip-radius); background: color-mix(in srgb, var(--tcolor, var(--primary-color)) 10%, transparent); overflow: hidden; }
      .vfill { height: 100%; background: var(--tcolor, var(--primary-color)); transition: width 1s linear, height 1s linear; border-radius: var(--stc-chip-radius); }
      .vprogressbar { width: 100%; display: flex; align-items: center; justify-content: center; gap: 0px; margin-top: -4px; margin-bottom: -4px; }
      .vprogressbar .milestone-track { flex: 0 0 60%; }
      .vactions { display: flex; gap: 6px; align-items: center; justify-content: center; margin-top: -4px; margin-bottom: -4px; }
      .vcircle-wrap { position: relative; width: 64px; height: 64px; display: grid; place-items: center; }
      .vcircle { position: absolute; inset: 0; transform: rotate(-90deg); z-index: 0; }
      .vc-track, .vc-prog { fill: none; stroke-width: 4.5px; vector-effect: non-scaling-stroke; }
      .vc-track { stroke: var(--tcolor, var(--primary-color)); stroke-opacity: 0.22; }
      .vc-prog { stroke: var(--tcolor, var(--primary-color)); transition: stroke-dashoffset 1s linear; }
      .vc-prog.done { stroke-dashoffset: 0 !important; }
      .vc-prog-drain { stroke: var(--tcolor, var(--primary-color)); transition: stroke-dashoffset 1s linear; }
      .icon-wrap.xl { width: 44px; height: 44px; flex: 0 0 44px; border-radius: 50%; background: color-mix(in srgb, var(--tcolor, var(--divider-color)) 22%, transparent); display: flex; align-items: center; justify-content: center; position: relative; z-index: 1; }
      .icon-wrap.xl ha-icon { --mdc-icon-size: 28px; color: var(--tcolor, var(--primary-color)); }
      .milestone-track { display: flex; gap: 1px; width: 100%; height: 8px; margin-top: 2px; }
      .vprogressbar .milestone-track { flex: 0 0 60%; }
      .milestone-track.idle .segment { background: color-mix(in srgb, var(--tcolor, var(--primary-color)) 15%, transparent); }
      .segment { flex: 1 1 0; height: 100%; background: color-mix(in srgb, var(--tcolor, var(--primary-color)) 15%, transparent); border-radius: 1px; }
      .segment.completed { background: var(--tcolor, var(--primary-color)); }
      .segment.active { animation: pulseMilestone 1s ease-in-out infinite; }
      .segment.inactive { opacity: 0.35; }
      .segment.drain.completed { opacity: 0.9; }
      .segment.drain.inactive { opacity: 0.2; }
      .segment.idle { background: color-mix(in srgb, var(--tcolor, var(--primary-color)) 15%, transparent); }
      @keyframes pulseMilestone { 0% { opacity: 1; } 50% { opacity: 0.3; } 100% { opacity: 1; } }
      .editor-row { flex-direction: column; align-items: center; padding: 12px; height: auto !important; min-height: 100px; }
      .editor-container { width: 100%; display: flex; flex-direction: column; align-items: center; }
      .editor-header { font-weight: 700; font-size: 1.1em; margin-bottom: 12px; }
      .time-picker-row { display: flex; justify-content: center; align-items: center; margin-bottom: 16px; }
      .time-slot { display: flex; flex-direction: column; align-items: center; margin: 0 6px; }
      .time-slot ha-icon { cursor: pointer; color: var(--primary-color); --mdc-icon-size: 32px; }
      .time-val { font-size: 2em; font-weight: bold; margin: 4px 0; min-width: 45px; text-align: center; }
      .colon { font-size: 2em; font-weight: bold; margin-top: -15px; }
      .time-label { font-size: 0.75em; color: var(--secondary-text-color); }
    `}_toast(t){const e=new CustomEvent("hass-notification",{detail:{message:t},bubbles:!0,composed:!0});this.dispatchEvent(e)}}class _t extends ot{static get properties(){return{hass:{},_config:{},_expandedSections:{state:!0}}}constructor(){super(),this._debounceTimeout=null,this._emitTimeout=null,this._expandedSections={basics:!0,layout:!1,presets:!1,pinned:!1,storage:!1,entities:!0}}disconnectedCallback(){super.disconnectedCallback(),this._debounceTimeout&&(clearTimeout(this._debounceTimeout),this._debounceTimeout=null),this._emitTimeout&&(clearTimeout(this._emitTimeout),this._emitTimeout=null)}setConfig(t){const e={...t||{}};"string"==typeof e.timer_name_presets&&(e.timer_name_presets=e.timer_name_presets.split(",").map(t=>t.trim()).filter(Boolean)),"string"==typeof e.timer_presets&&(e.timer_presets=e.timer_presets.split(",").map(t=>t.trim()).filter(Boolean)),"string"==typeof e.minute_buttons&&(e.minute_buttons=e.minute_buttons.split(",").map(t=>t.trim()).filter(Boolean)),"string"==typeof e.time_format_units&&(e.time_format_units=e.time_format_units.split(",").map(t=>t.trim()).filter(Boolean)),this._config={...e},this._expandedSections||(this._expandedSections={basic:!0,time:!1,general:!1,presets:!1,pinned:!1,storage:!1,audio:!1,entities:!0}),this.requestUpdate()}_valueChanged(t){if(!this._config||!this.hass)return;const e=t.target,i=e.configValue??e.dataset?.configValue??e.getAttribute?.("configValue");if(!i)return;const s=void 0!==e.checked;let r=s?e.checked:e.value;if("timer_presets"===i&&"string"==typeof r&&(r=r.split(",").map(t=>t.trim()).filter(t=>t).map(t=>{if(t.toLowerCase().endsWith("s")){const e=parseInt(t.slice(0,-1),10);if(!isNaN(e)&&e>0)return`${e}s`}const e=parseInt(t,10);return!isNaN(e)&&e>0?e:null}).filter(t=>null!==t),0===r.length&&(r=[5,15,30])),"minute_buttons"===i&&"string"==typeof r&&(r=r.split(",").map(t=>t.trim()).filter(t=>t).map(t=>{if(t.toLowerCase().endsWith("s")){const e=parseInt(t.slice(0,-1),10);if(!isNaN(e)&&e>0)return`${e}s`}const e=parseInt(t,10);return!isNaN(e)&&e>0?e:null}).filter(t=>null!==t),0===r.length&&(r=[1,5,10])),"timer_name_presets"===i&&"string"==typeof r&&(r=r.split(",").map(t=>t.trim()).filter(t=>t)),"time_format_units"===i&&"string"==typeof r&&(r=r.split(",").map(t=>t.trim().toLowerCase()).filter(t=>["years","months","weeks","days","hours","minutes","seconds"].includes(t)),0===r.length&&(r=["days","hours","minutes","seconds"])),"auto_voice_pe"===i&&!0!==r){const t={...this._config};return delete t.auto_voice_pe,delete t.voice_pe_control_entity,this._config=t,void this._emitChange()}s?this._updateConfig({[i]:r},!0):this._updateConfig({[i]:r})}_detailValueChanged(t){if(!this._config||!this.hass)return;const e=t.target,i=e.configValue??e.dataset?.configValue??e.getAttribute?.("configValue");i&&this._updateConfig({[i]:t.detail.value})}_selectChanged(t){if(!this._config||!this.hass)return;const e=t.target,i=e.configValue??e.dataset?.configValue??e.getAttribute?.("configValue");if(!i)return;t.stopPropagation();const s=void 0!==t.detail?.value?t.detail.value:e.value;if("string"==typeof s&&""!==s)if("style"===i){const t=s.toLowerCase(),e=["fill_vertical","fill_horizontal","bar_vertical","bar_horizontal","circle"].includes(t)?t:"bar_horizontal";this._updateConfig({style:e},!0)}else if("progress_mode"===i){const t=["drain","fill","milestones"];this._updateConfig({progress_mode:t.includes(s)?s:"drain"},!0)}else if("time_format"===i){const t=["hms","hm","ss","dhms","human_compact","human_short","human_natural","standard"],e="standard"===s?"hms":s;this._updateConfig({time_format:t.includes(e)?e:"hms"},!0)}else if("milestone_unit"===i){const t=["auto","none","years","months","weeks","days","hours","minutes","seconds"];this._updateConfig({milestone_unit:t.includes(s)?s:"auto"},!0)}else this._updateConfig({[i]:s},!0)}_entityValueChanged(t,e){if(!this._config||!this.hass)return;if(t.stopPropagation&&t.stopPropagation(),e<0||e>=(this._config.entities||[]).length)return;const i=t.target,s=i.configValue??i.dataset?.configValue??i.getAttribute?.("configValue");if(!s)return;let r;if(void 0!==i.checked)r=i.checked;else if(t.detail&&void 0!==t.detail.value)r=t.detail.value;else{if(void 0===i.value)return;r=i.value}const n={...this._config},o=[...n.entities||[]];let a;a="string"==typeof o[e]?{entity:o[e]}:o[e]&&"object"==typeof o[e]?{...o[e]}:{entity:""},""===r||null==r?delete a[s]:a[s]=r,1===Object.keys(a).length&&a.entity?o[e]=a.entity:Object.keys(a).length>0?o[e]=a:o[e]="",n.entities=o,this._updateConfig(n,!0)}_addPinnedTimer(){const t=Array.isArray(this._config.pinned_timers)?[...this._config.pinned_timers]:[];t.push({name:"",duration:"5m"}),this._config={...this._config,pinned_timers:t},this._emitChange()}_removePinnedTimer(t){const e=Array.isArray(this._config.pinned_timers)?[...this._config.pinned_timers]:[];e.splice(t,1),this._config={...this._config,pinned_timers:e},this._emitChange()}_pinnedTimerValueChanged(t,e){if(!this._config||!this.hass)return;const i=t.target,s=i.configValue??i.dataset?.configValue??i.getAttribute?.("configValue");if(!s)return;let r=void 0!==i.checked?i.checked:void 0!==i.value?i.value:t?.detail?.value;if("audio_repeat_count"===s){const t=parseInt(r,10);r=Number.isFinite(t)&&t>0?t:1}const n=Array.isArray(this._config.pinned_timers)?[...this._config.pinned_timers]:[],o=n[e]&&"object"==typeof n[e]?{...n[e]}:{};o[s]=r,n[e]=o,this._config={...this._config,pinned_timers:n},this._emitChange()}_addEntity(){if(!this._config)return;const t={...this._config},e=[...t.entities||[]];e.push(""),t.entities=e,this._updateConfig(t,!0)}_removeEntity(t){if(!this._config||t<0||t>=(this._config.entities||[]).length)return;const e={...this._config},i=[...e.entities];i.splice(t,1),e.entities=i,this._updateConfig(e,!0)}_updateConfig(t,e=!1){this._config&&("object"==typeof t&&null!==t&&(void 0!==t.entities?this._config=t:this._config={...this._config,...t}),e?this._emitChange():(this._emitTimeout&&clearTimeout(this._emitTimeout),this._emitTimeout=setTimeout(()=>{this._emitChange(),this._emitTimeout=null},50)))}_emitChange(){if(this._config)try{const t=this._removeDefaultValues(this._config),e=new CustomEvent("config-changed",{detail:{config:t},bubbles:!0,composed:!0});this.dispatchEvent(e)}catch(t){}}_removeDefaultValues(t){const e={layout:"horizontal",style:"bar_horizontal",progress_mode:"drain",show_timer_presets:!0,timer_presets:[5,15,30],timer_name_presets:[],snooze_duration:5,show_active_header:!0,minute_buttons:[1,5,10],default_new_timer_duration_mins:15,time_format:"hms",time_format_units:["days","hours","minutes","seconds"],expire_action:"keep",expire_keep_for:120,auto_dismiss_writable:!1,audio_enabled:!1,audio_file_url:"",audio_repeat_count:1,audio_play_until_dismissed:!1,audio_completion_delay:4,expired_subtitle:null,default_timer_icon:"mdi:timer-outline",default_timer_color:"var(--primary-color)",default_timer_entity:null,keep_timer_visible_when_idle:!1,language:"en",milestone_unit:"auto",milestone_pulse:!0},i={...t||{}};delete i.alexa_audio_enabled,delete i.alexa_audio_file_url,delete i.alexa_audio_repeat_count,delete i.alexa_audio_play_until_dismissed;const s=t=>Array.isArray(t)?t.map(t=>String(t).trim()).filter(Boolean):"string"==typeof t?t.split(",").map(t=>t.trim()).filter(Boolean):[];if("string"==typeof i.entities&&(i.entities=[i.entities]),Array.isArray(i.entities)||delete i.entities,Array.isArray(i.entities)&&0===i.entities.filter(t=>String(t||"").trim()).length&&delete i.entities,Array.isArray(i.pinned_timers)&&0!==i.pinned_timers.length||delete i.pinned_timers,void 0!==i.timer_name_presets&&(i.timer_name_presets=s(i.timer_name_presets)),void 0!==i.time_format_units&&(i.time_format_units=s(i.time_format_units)),void 0!==i.timer_presets){const t=Array.isArray(i.timer_presets)?i.timer_presets:"string"==typeof i.timer_presets?i.timer_presets.split(","):[];i.timer_presets=t.map(t=>"number"==typeof t?t:String(t).trim()).filter(t=>""!==t)}if(void 0!==i.minute_buttons){const t=Array.isArray(i.minute_buttons)?i.minute_buttons:"string"==typeof i.minute_buttons?i.minute_buttons.split(","):[];i.minute_buttons=t.map(t=>Number(String(t).trim())).filter(t=>Number.isFinite(t))}const r=t=>{""!==i[t]&&null!==i[t]&&void 0!==i[t]||delete i[t],Array.isArray(i[t])&&0===i[t].length&&delete i[t]};r("audio_file_url"),r("expired_subtitle"),r("title"),r("default_timer_entity"),i.audio_enabled||(delete i.audio_file_url,delete i.audio_repeat_count,delete i.audio_play_until_dismissed,delete i.audio_completion_delay),!1===i.show_timer_presets&&(delete i.timer_presets,delete i.timer_name_presets);const n=(t,e)=>Array.isArray(t)&&Array.isArray(e)&&t.length===e.length&&t.every((t,i)=>t===e[i]);for(const[t,s]of Object.entries(e)){if(!(t in i))continue;const e=i[t];Array.isArray(s)?n(e,s)&&delete i[t]:e===s&&delete i[t]}return i.mqtt&&"object"==typeof i.mqtt&&0===Object.keys(i.mqtt).length&&delete i.mqtt,i}async firstUpdated(){["ha-entity-picker","ha-select","ha-textfield","ha-icon-picker","ha-form","mwc-list-item"].forEach(t=>{customElements.whenDefined(t).then(()=>this.requestUpdate()).catch(()=>{})}),this._ensureEntityPickerLoaded(),this.requestUpdate()}_ensureEntityPickerLoaded(){if(!customElements.get("ha-entity-picker"))try{const t=document.createElement("ha-form");t.style.display="none",t.schema=[{name:"e",selector:{entity:{}}}],t.data={},t.hass=this.hass,this.shadowRoot?.appendChild(t),setTimeout(()=>t.remove(),0)}catch(t){}}_getDisplayStyleValue(){return this._config.style||"bar_horizontal"}_detectMode(t,e,i){if(!e)return null;if(t.startsWith("timer."))return"timer";if(t.startsWith("input_text.")||t.startsWith("text."))return"helper";const s=e.attributes||{};if(null!=s.alarms_brief||null!=s.sorted_active||null!=s.sorted_paused||null!=s.sorted_all||null!=s.next_timer||null!=s.timers||(t.includes("next_timer")||t.endsWith("_next_timer"))&&(null!=s.total_active||null!=s.total_all||null!=s.status||null!=s.timer||null!=s.dismissed))return"alexa";if("timestamp"===s.device_class)return"timestamp";const r=i?.minutes_attr;if(r&&null!==(s[r]??null))return"minutes_attr";if(s.start_time)return"timestamp";const n=e.state;return n&&"unknown"!==n&&"unavailable"!==n&&isNaN(n)&&!isNaN(Date.parse(n))?"timestamp":null}_toggleSection(t){this._expandedSections={...this._expandedSections||{},[t]:!this._expandedSections?.[t]}}render(){if(!this.hass||!this._config)return H``;const t=!!customElements.get("ha-entity-picker"),e=this._config.default_timer_entity?.startsWith("sensor.")?"mqtt":"local",i="milestones"===this._config.progress_mode,s=(t,e,i)=>H`
      <div class="section">
        <div class="section-header" @click=${()=>this._toggleSection(t)}>
          <span class="section-title">${e}</span>
          <ha-icon icon=${this._expandedSections?.[t]?"mdi:chevron-up":"mdi:chevron-down"}></ha-icon>
        </div>
        ${this._expandedSections?.[t]?H`<div class="section-content">${i}</div>`:""}
      </div>
    `,r=H`
      <ha-textfield label="Title (Optional)" .value=${this._config.title||""} .configValue=${"title"} @input=${this._valueChanged}></ha-textfield>

      <div class="side-by-side">
        <ha-select label="Layout" .value=${this._config.layout||"horizontal"} .configValue=${"layout"} @selected=${this._selectChanged} @closed=${t=>{t.stopPropagation(),this._selectChanged(t)}}>
          <mwc-list-item value="horizontal">Horizontal</mwc-list-item>
          <mwc-list-item value="vertical">Vertical</mwc-list-item>
        </ha-select>

        <ha-select label="Style" .value=${this._getDisplayStyleValue()} .configValue=${"style"} @selected=${this._selectChanged} @closed=${t=>{t.stopPropagation(),this._selectChanged(t)}}>
          <mwc-list-item value="fill_vertical">Background fill (vertical)</mwc-list-item>
          <mwc-list-item value="fill_horizontal">Background fill (horizontal)</mwc-list-item>
          <mwc-list-item value="bar_vertical">Progress bar (vertical)</mwc-list-item>
          <mwc-list-item value="bar_horizontal">Progress bar (horizontal)</mwc-list-item>
          <mwc-list-item value="circle">Circle</mwc-list-item>
        </ha-select>
      </div>

      <div class="side-by-side">
        <ha-select label="Progress Mode" .value=${this._config.progress_mode||"drain"} .configValue=${"progress_mode"} @selected=${this._selectChanged} @closed=${t=>{t.stopPropagation(),this._selectChanged(t)}}>
          <mwc-list-item value="drain">Drain</mwc-list-item>
          <mwc-list-item value="fill">Fill</mwc-list-item>
          <mwc-list-item value="milestones">Milestones (bar styles only)</mwc-list-item>
        </ha-select>

        <ha-select label="Language" .value=${this._config.language||"en"} .configValue=${"language"} @selected=${this._selectChanged} @closed=${t=>{t.stopPropagation(),this._selectChanged(t)}}>
          <mwc-list-item value="en">English</mwc-list-item>
          <mwc-list-item value="de">Deutsch</mwc-list-item>
          <mwc-list-item value="es">Español</mwc-list-item>
		  <mwc-list-item value="da">Dansk</mwc-list-item>
        </ha-select>
      </div>
    `,n=H`
      <ha-select label="Time format" .value=${this._config.time_format||"hms"} .configValue=${"time_format"} @selected=${this._selectChanged} @closed=${t=>{t.stopPropagation(),this._selectChanged(t)}}>
        <mwc-list-item value="hms">HH:MM:SS</mwc-list-item>
        <mwc-list-item value="hm">HH:MM</mwc-list-item>
        <mwc-list-item value="ss">Seconds only</mwc-list-item>
        <mwc-list-item value="dhms">DD:HH:MM:SS</mwc-list-item>
        <mwc-list-item value="human_compact">Unit style, compact</mwc-list-item>
        <mwc-list-item value="human_short">Unit style, short labels</mwc-list-item>
        <mwc-list-item value="human_natural">Unit style, natural language</mwc-list-item>
      </ha-select>

      <ha-textfield label="Unit order (comma-separated)" helper="years,months,weeks,days,hours,minutes,seconds" .value=${(this._config.time_format_units||["days","hours","minutes","seconds"]).join(",")} .configValue=${"time_format_units"} @input=${this._valueChanged}></ha-textfield>

      ${i?H`
        <div class="subsection-title">Progress milestones</div>
        <div class="side-by-side" style="align-items:flex-start;">
          <ha-select label="Milestone unit" .value=${this._config.milestone_unit||"auto"} .configValue=${"milestone_unit"} @selected=${this._selectChanged} @closed=${t=>{t.stopPropagation(),this._selectChanged(t)}}>
            <mwc-list-item value="auto">Auto (default)</mwc-list-item>
            <mwc-list-item value="none">None</mwc-list-item>
            <mwc-list-item value="years">Years</mwc-list-item>
            <mwc-list-item value="months">Months</mwc-list-item>
            <mwc-list-item value="weeks">Weeks</mwc-list-item>
            <mwc-list-item value="days">Days</mwc-list-item>
            <mwc-list-item value="hours">Hours</mwc-list-item>
            <mwc-list-item value="minutes">Minutes</mwc-list-item>
            <mwc-list-item value="seconds">Seconds</mwc-list-item>
          </ha-select>
          <ha-formfield label="Pulse active milestone">
            <ha-switch .checked=${!1!==this._config.milestone_pulse} .configValue=${"milestone_pulse"} @change=${this._valueChanged}></ha-switch>
          </ha-formfield>
        </div>
      `:""}
    `,o=H`
      <ha-formfield label="Show 'Active Timers' header">
        <ha-switch .checked=${!1!==this._config.show_active_header} .configValue=${"show_active_header"} @change=${this._valueChanged}></ha-switch>
      </ha-formfield>

      <div class="side-by-side">
        <ha-textfield label="Default Duration (minutes)" type="number" .value=${this._config.default_new_timer_duration_mins??15} .configValue=${"default_new_timer_duration_mins"} @input=${this._valueChanged}></ha-textfield>
        <ha-textfield label="Snooze Duration (minutes)" type="number" .value=${this._config.snooze_duration??5} .configValue=${"snooze_duration"} @input=${this._valueChanged}></ha-textfield>
      </div>

      <div class="side-by-side">
        <ha-select label="When timer reaches 0" .value=${this._config.expire_action||"keep"} .configValue=${"expire_action"} @selected=${this._selectChanged} @closed=${t=>{t.stopPropagation(),this._selectChanged(t)}}>
          <mwc-list-item value="keep">Keep visible</mwc-list-item>
          <mwc-list-item value="dismiss">Dismiss</mwc-list-item>
          <mwc-list-item value="remove">Remove</mwc-list-item>
        </ha-select>
        <ha-textfield label="Keep-visible duration (seconds)" type="number" .value=${this._config.expire_keep_for??120} .configValue=${"expire_keep_for"} @input=${this._valueChanged}></ha-textfield>
      </div>

      <ha-formfield label="Auto-dismiss helper timers at 0">
        <ha-switch .checked=${!0===this._config.auto_dismiss_writable} .configValue=${"auto_dismiss_writable"} @change=${this._valueChanged}></ha-switch>
      </ha-formfield>

      <div class="side-by-side">
        <ha-icon-picker label="Default timer icon" .value=${this._config.default_timer_icon||"mdi:timer-outline"} .configValue=${"default_timer_icon"} @value-changed=${this._detailValueChanged}></ha-icon-picker>
        <ha-textfield label="Default timer color" .value=${this._config.default_timer_color||"var(--primary-color)"} .configValue=${"default_timer_color"} @input=${this._valueChanged}></ha-textfield>
      </div>

      <ha-textfield label="Timer expired message" .value=${this._config.expired_subtitle||""} .configValue=${"expired_subtitle"} @input=${this._valueChanged} placeholder="Time's up!"></ha-textfield>
    `,a=H`
      <ha-formfield label="Show timer preset buttons">
        <ha-switch .checked=${!1!==this._config.show_timer_presets} .configValue=${"show_timer_presets"} @change=${this._valueChanged}></ha-switch>
      </ha-formfield>

      ${!1!==this._config.show_timer_presets?H`
        <ha-textfield label="Timer presets (minutes or secs, e.g. 5, 90s)" .value=${(this._config.timer_presets||[5,15,30]).join(", ")} .configValue=${"timer_presets"} @input=${this._valueChanged}></ha-textfield>
        <ha-textfield label="Timer name presets (comma-separated)" .value=${(this._config.timer_name_presets||[]).join(", ")} .configValue=${"timer_name_presets"} @input=${this._valueChanged}></ha-textfield>
      `:""}

      <ha-textfield label="Minute adjustment buttons (comma-separated)" .value=${(this._config.minute_buttons||[1,5,10]).join(", ")} .configValue=${"minute_buttons"} @input=${this._valueChanged}></ha-textfield>
    `,l=H`
  <div class="entities-header">
    <h3>Pinned timers</h3>
    <button class="add-entity-button" @click=${this._addPinnedTimer} title="Add pinned timer">
      <ha-icon icon="mdi:plus"></ha-icon>
    </button>
  </div>

  ${0===(Array.isArray(this._config.pinned_timers)?this._config.pinned_timers:[]).length?H`<div class="no-entities">No pinned timers configured. Click the + button above to add one.</div>`:(this._config.pinned_timers||[]).map((t,e)=>H`
        <div class="entity-editor">
          <div class="entity-options" style="width:100%;">
            <div class="side-by-side">
              <ha-textfield
                label="Name"
                .value=${t?.name||""}
                .configValue=${"name"}
                @input=${t=>this._pinnedTimerValueChanged(t,e)}
              ></ha-textfield>

              <ha-textfield
                label="Duration"
                .value=${t?.duration??t?.preset??"5m"}
                .configValue=${"duration"}
                @input=${t=>this._pinnedTimerValueChanged(t,e)}
                helper-text="Examples: 5m, 90s, 1h"
              ></ha-textfield>
            </div>

            <div class="side-by-side">
              <ha-icon-picker
                label="Icon"
                .value=${t?.icon||""}
                .configValue=${"icon"}
                @value-changed=${t=>{t.target.configValue="icon",this._pinnedTimerValueChanged(t,e)}}
              ></ha-icon-picker>

              <ha-textfield
                label="Color"
                .value=${t?.color||""}
                .configValue=${"color"}
                @input=${t=>this._pinnedTimerValueChanged(t,e)}
              ></ha-textfield>
            </div>

            <ha-textfield
              label="Expired message"
              .value=${t?.expired_subtitle||""}
              .configValue=${"expired_subtitle"}
              @input=${t=>this._pinnedTimerValueChanged(t,e)}
            ></ha-textfield>

            <ha-formfield label="Enable specific audio">
              <ha-switch
                .checked=${!0===t?.audio_enabled}
                .configValue=${"audio_enabled"}
                @change=${t=>this._pinnedTimerValueChanged(t,e)}
              ></ha-switch>
            </ha-formfield>

            ${t?.audio_enabled?H`
              <div class="side-by-side">
                <ha-textfield
                  label="Audio file URL"
                  .value=${t?.audio_file_url||""}
                  .configValue=${"audio_file_url"}
                  @input=${t=>this._pinnedTimerValueChanged(t,e)}
                ></ha-textfield>

                <ha-textfield
                  label="Repeat count"
                  type="number"
                  min="1"
                  max="10"
                  .value=${t?.audio_repeat_count??1}
                  .configValue=${"audio_repeat_count"}
                  @input=${t=>this._pinnedTimerValueChanged(t,e)}
                ></ha-textfield>
              </div>

              <ha-formfield label="Play until dismissed or snoozed">
                <ha-switch
                  .checked=${!0===t?.audio_play_until_dismissed}
                  .configValue=${"audio_play_until_dismissed"}
                  @change=${t=>this._pinnedTimerValueChanged(t,e)}
                ></ha-switch>
              </ha-formfield>
            `:""}
          </div>

          <button class="remove-entity" @click=${()=>this._removePinnedTimer(e)} title="Remove pinned timer">
            <ha-icon icon="mdi:delete"></ha-icon>
          </button>
        </div>
      `)}
`,c=H`
      <ha-entity-picker
        .hass=${this.hass}
        .value=${this._config.default_timer_entity||""}
        .configValue=${"default_timer_entity"}
        @value-changed=${this._detailValueChanged}
        label="Default Timer Storage (Optional)"
        help-text="Select a helper (input_text) or an MQTT sensor to store timers."
        allow-custom-entity
        .includeDomains=${["input_text","text","sensor"]}
      ></ha-entity-picker>
      <ha-formfield label="Auto use Voice PE (if available)">
        <ha-switch .checked=${!0===this._config.auto_voice_pe} .configValue=${"auto_voice_pe"} @change=${this._valueChanged}></ha-switch>
      </ha-formfield>

      ${!0===this._config.auto_voice_pe?H`
            <ha-entity-picker
              .hass=${this.hass}
              .value=${this._config.voice_pe_control_entity||""}
              .configValue=${"voice_pe_control_entity"}
              .includeDomains=${["text","input_text"]}
              allow-custom-entity
              label="Voice PE control entity"
              @value-changed=${this._valueChanged}
            ></ha-entity-picker>
          `:""}

      <div class="storage-info">
        <span class="storage-label">Storage type: <strong>${this._getStorageDisplayName(e)}</strong></span>
        <small class="storage-description">${this._getStorageDescription(e)}</small>
      </div>
    `,d=H`
      <ha-formfield label="Enable audio notifications">
        <ha-switch .checked=${!0===this._config.audio_enabled} .configValue=${"audio_enabled"} @change=${this._valueChanged}></ha-switch>
      </ha-formfield>
      ${this._config.audio_enabled?H`
        <ha-textfield label="Audio file URL or path" .value=${this._config.audio_file_url||""} .configValue=${"audio_file_url"} @input=${this._valueChanged}></ha-textfield>
        <ha-textfield label="Audio completion delay (seconds)" type="number" min="1" max="30" .value=${this._config.audio_completion_delay??4} .configValue=${"audio_completion_delay"} @input=${this._valueChanged}></ha-textfield>
        <ha-textfield label="Number of times to play" type="number" min="1" max="10" .value=${this._config.audio_repeat_count??1} .configValue=${"audio_repeat_count"} @input=${this._valueChanged}></ha-textfield>
        <ha-formfield label="Play audio until timer is dismissed or snoozed">
          <ha-switch .checked=${!0===this._config.audio_play_until_dismissed} .configValue=${"audio_play_until_dismissed"} @change=${this._valueChanged}></ha-switch>
        </ha-formfield>
      `:""}
    `,u=H`
      <div class="entities-header">
        <h3>Entities</h3>
        <button class="add-entity-button" @click=${this._addEntity} title="Add timer entity"><ha-icon icon="mdi:plus"></ha-icon></button>
      </div>

      ${0===(this._config.entities||[]).length?H`<div class="no-entities">No entities configured. Click the + button above to add timer entities.</div>`:(this._config.entities||[]).map((e,i)=>{const s="string"==typeof e?e:e?.entity||"",r="string"==typeof e?{}:e||{},n=this.hass.states[s],o=this._detectMode(s,n,r),a=!r.mode||"auto"===r.mode,l="timestamp"===r.mode||a&&"timestamp"===o;return H`
              <div class="entity-editor">
                ${t?H`
                  <ha-entity-picker
                    .hass=${this.hass}
                    .value=${s}
                    .configValue=${"entity"}
                    allow-custom-entity
                    @value-changed=${t=>this._entityValueChanged(t,i)}
                  ></ha-entity-picker>
                `:H`
                  <ha-textfield
                    label="Entity (type while picker loads)"
                    .value=${s}
                    .configValue=${"entity"}
                    @input=${t=>this._entityValueChanged(t,i)}
                  ></ha-textfield>
                `}
                <div class="entity-options">
                  <div class="side-by-side" style="align-items:flex-start;">
                    <div style="flex:1;">
                      <ha-select label="Mode" .value=${r.mode||"auto"} .configValue=${"mode"}
                        @selected=${t=>{t.stopPropagation(),this._entityValueChanged(t,i)}} @closed=${t=>{t.stopPropagation(),this._entityValueChanged(t,i)}}>
                        <mwc-list-item value="auto">Auto (Default)</mwc-list-item>
                        <mwc-list-item value="alexa">Alexa</mwc-list-item>
                        <mwc-list-item value="timer">Timer</mwc-list-item>
                        <mwc-list-item value="voice_pe">Voice PE</mwc-list-item>
                        <mwc-list-item value="helper">Helper (input_text/text)</mwc-list-item>
                        <mwc-list-item value="timestamp">Timestamp sensor</mwc-list-item>
                        <mwc-list-item value="minutes_attr">Minutes attribute</mwc-list-item>
                      </ha-select>
                      ${a&&o?H`
                        <div class="helper-text">
                          Detected mode: <strong>${"unknown"===o?"Unknown":o.charAt(0).toUpperCase()+o.slice(1)}</strong>
                        </div>
                      `:""}
                    </div>

                    ${"minutes_attr"===r.mode?H`
                      <ha-textfield label="Minutes attribute" .value=${r.minutes_attr||""} .configValue=${"minutes_attr"} @input=${t=>this._entityValueChanged(t,i)}></ha-textfield>
                    `:""}

                    ${l?H`
                      <ha-entity-picker
                          .hass=${this.hass}
                          .value=${r.start_time_entity||""}
                          .configValue=${"start_time_entity"}
                          @value-changed=${t=>this._entityValueChanged(t,i)}
                          label="Start time entity"
                          allow-custom-entity
                      ></ha-entity-picker>
                    `:""}
                  </div>

                  ${l?H`
                    <ha-textfield
                      label="Start time attribute (Optional)"
                      .value=${r.start_time_attr||""}
                      .configValue=${"start_time_attr"}
                      @input=${t=>this._entityValueChanged(t,i)}
                      helper-text="Attribute on this entity containing the start timestamp (e.g., 'last_triggered')."
                    ></ha-textfield>
                  `:""}

                  <div class="side-by-side">
                    <ha-textfield label="Name Override" .value=${r.name||""} .configValue=${"name"} @input=${t=>this._entityValueChanged(t,i)}></ha-textfield>
                    <ha-icon-picker label="Icon Override" .value=${r.icon||""} .configValue=${"icon"} @value-changed=${t=>this._entityValueChanged(t,i)}></ha-icon-picker>
                    <ha-textfield label="Color Override" .value=${r.color||""} .configValue=${"color"} @input=${t=>this._entityValueChanged(t,i)}></ha-textfield>
                  </div>

                  <ha-textfield label="Expired message override" .value=${r.expired_subtitle||""} .configValue=${"expired_subtitle"} @input=${t=>this._entityValueChanged(t,i)}></ha-textfield>

                  <ha-formfield label="Enable entity-specific audio">
                    <ha-switch .checked=${!0===r.audio_enabled} .configValue=${"audio_enabled"} @change=${t=>this._entityValueChanged(t,i)}></ha-switch>
                  </ha-formfield>

                  ${r.audio_enabled?H`
                    <div class="side-by-side">
                      <ha-textfield label="Audio file URL" .value=${r.audio_file_url||""} .configValue=${"audio_file_url"} @input=${t=>this._entityValueChanged(t,i)}></ha-textfield>
                      <ha-textfield label="Audio repeat count" type="number" min="1" max="10" .value=${r.audio_repeat_count??1} .configValue=${"audio_repeat_count"} @input=${t=>this._entityValueChanged(t,i)}></ha-textfield>
                    </div>
                  `:""}

                  ${"timer"===r.mode||a&&"timer"===o?H`
                    <ha-formfield label="Keep visible when idle">
                      <ha-switch .checked=${!0===r.keep_timer_visible_when_idle} .configValue=${"keep_timer_visible_when_idle"} @change=${t=>this._entityValueChanged(t,i)}></ha-switch>
                    </ha-formfield>
                    <ha-formfield label="Hide action buttons">
                      <ha-switch .checked=${!0===r.hide_timer_actions} .configValue=${"hide_timer_actions"} @change=${t=>this._entityValueChanged(t,i)}></ha-switch>
                    </ha-formfield>
                  `:""}
                </div>

                <button class="remove-entity" @click=${()=>this._removeEntity(i)} title="Remove entity"><ha-icon icon="mdi:delete"></ha-icon></button>
              </div>
            `})}
    `;return H`
      <div class="card-config">
        ${s("basics","Basics",H`${r}<div class="divider"></div>${n}<div class="divider"></div>${d}`)}
        ${s("layout","Layout",o)}
        ${s("presets","Presets",a)}
        ${s("pinned","Pinned timers",l)}
        ${s("storage","Storage",c)}
        ${s("entities","Entities",u)}
      </div>
    `}_getStorageDisplayName(t){switch(t){case"local":return"Local Browser Storage";case"helper":return"Helper Entities";case"mqtt":return"MQTT";default:return"Unknown"}}_getStorageDescription(t){switch(t){case"local":return"Timers are stored locally in your browser and persist across sessions.";case"helper":return"Timers are stored in Home Assistant helper entities (input_text/text).";case"mqtt":return"Timers are stored via MQTT for cross-device sync. Select your MQTT sensor in 'Default Timer Storage'.";default:return""}}static get styles(){return n`
      .card-config { display: flex; flex-direction: column; gap: 4px; }

      .section { background: var(--card-background-color); border-radius: 8px; overflow: visible; margin-bottom: 4px; }
      .section-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; cursor: pointer; user-select: none; transition: background-color 0.2s; }
      .section-header:hover { background: rgba(var(--rgb-primary-text-color), 0.04); }
      .section-title { font-weight: 600; font-size: 14px; color: var(--primary-text-color); margin: 0; }
      .section-header ha-icon { color: var(--secondary-text-color); }
      .section-content { padding: 0 16px 16px 16px; display: flex; flex-direction: column; gap: 12px; animation: slideDown 0.2s ease-out; }

      @keyframes slideDown { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }

      .subsection-title { font-weight: 600; margin-top: 8px; margin-bottom: -4px; color: var(--primary-text-color); font-size: 0.9rem; }
      .side-by-side { display: flex; gap: 12px; }
      .side-by-side > * { flex: 1; min-width: 0; }

      .divider { height: 1px; background: var(--divider-color); margin: 8px 0; }

      .storage-info { padding: 12px; background: rgba(var(--rgb-primary-text-color), 0.02); border: 1px solid var(--divider-color); border-radius: 8px; display: flex; flex-direction: column; gap: 4px; }
      .storage-label { font-size: 0.9rem; color: var(--primary-text-color); }
      .storage-description { color: var(--secondary-text-color); font-size: 0.8rem; line-height: 1.2; }

      .entities-header { display: flex; justify-content: space-between; align-items: center; }
      .entities-header h3 { margin: 0; font-size: 14px; font-weight: 600; }
      .add-entity-button { background: var(--primary-color); border: none; border-radius: 50%; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: var(--text-primary-color, #fff); }
      .no-entities { text-align: center; color: var(--secondary-text-color); padding: 16px; font-style: italic; border: 2px dashed var(--divider-color); border-radius: 8px; margin: 8px 0; }

      .entity-editor { border: 1px solid var(--divider-color); border-radius: 8px; padding: 12px; position: relative; }
      .entity-options { display: flex; flex-direction: column; gap: 8px; margin-top: 12px; }
      .remove-entity { position: absolute; top: 6px; right: 6px; background: var(--error-color, #f44336); border: none; border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: white; }

      .helper-text { font-size: 11px; color: var(--secondary-text-color); margin-top: 4px; margin-left: 4px; }
    `}}customElements.get("simple-timer-card")||customElements.define("simple-timer-card",mt);const pt=()=>{customElements.get("simple-timer-card-editor")||customElements.define("simple-timer-card-editor",_t)};pt(),window.addEventListener("location-changed",()=>{setTimeout(pt,100)}),mt.getConfigElement=function(){if(pt(),customElements.get("simple-timer-card-editor"))return document.createElement("simple-timer-card-editor");const t=document.createElement("div");t.innerHTML="Loading editor...";const e=setInterval(()=>{if(customElements.get("simple-timer-card-editor")){clearInterval(e);const i=document.createElement("simple-timer-card-editor");t.replaceWith(i),t._config&&i.setConfig(t._config),t._hass&&(i.hass=t._hass)}},100),i=t.setConfig;return t.setConfig=function(e){t._config=e,i&&i.call(t,e)},Object.defineProperty(t,"hass",{set:function(e){t._hass=e},get:function(){return t._hass}}),t},setTimeout(()=>{window.customCards=window.customCards||[],window.customCards.push({type:"simple-timer-card",name:"Simple Timer Card",preview:!0,description:"Pick a layout (horizontal/vertical) and a style (progress bar/background fill). Uses HA theme & native elements.",editor:"simple-timer-card-editor"})},0);

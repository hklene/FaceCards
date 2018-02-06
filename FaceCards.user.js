// ==UserScript==
// @name        FaceCards
// @namespace   https://openuserjs.org/users/hklene
// @description Gesichter lernen mit Karteikarten
// @copyright   2018, hklene (https://openuserjs.org/users/hklene)
// @license     GPL-3.0
// @version     2018-02-05
// @include     https://confluence.bredex.de/browsepeople.action*
// @include     https://confluence.bredex.de/dopeopledirectorysearch.action*
// @icon        https://confluence.bredex.de/images/icons/profilepics/default.png
// @grant       none
// ==/UserScript==

// ==OpenUserJS==
// @author hklene
// ==OpenUserJS==

// Der Inhalt dieser umschließenden Funktion wird komplett in die Seite injiziert (benötigt keinen Zugriff auf besondere GreaseMonkey-API).
function injectContent() {
    // BEGIN injectContent()

// http://de.selfhtml.org/xml/darstellung/xpathsyntax.htm
function viaXpath(path, node, ordered) {
    return document.evaluate(path, node ? node : document, null,
        ordered ? XPathResult.ORDERED_NODE_SNAPSHOT_TYPE : XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE,
        null);
}

// https://developer.mozilla.org/en-US/docs/Introduction_to_using_XPath_in_JavaScript#First_Node
function viaXpath0(path, node, ordered) {
    return document.evaluate(path, node ? node : document, null,
        ordered ? XPathResult.FIRST_ORDERED_NODE_TYPE : XPathResult.ANY_UNORDERED_NODE_TYPE,
        null).singleNodeValue;
}

// Lightbox nach Denis Potschien: http://www.drweb.de/magazin/css3-lightbox-komplett-ohne-javascript
function lightboxStyle() { /*
DIV.lightbox {
    overflow: hidden;
    position: fixed;
    width:   0;
    height:  0;
    left:    0;
    top:     0;
    opacity: 0;
    background: rgba(127,127,127, 0.95);
    -moz-transition:    opacity 0.5s;
    -o-transition:      opacity 0.5s;
    -webkit-transition: opacity 0.5s;
}

DIV.lightbox:target {
    width:  100%;
    height: 100%;
    opacity: 1;
    z-index: 100;
}
*/}

function lightboxContent() { /*
<TABLE width="100%" border="0" style="padding:10px;"><TR>
<TD><A href="javascript:auswertung();" title="Auswertung"><H1>A</H1></A></TD>
<TD><CENTER id="FaceCardsNumber"></CENTER></TD>
<TD><A href="#" title="Schließen"><H1 style="text-align:right;">X</H1></A></TD>
</TR></TABLE>
<CENTER>
    <IMG id="FaceCardsImg" style="height:512px">
    <DIV id="FaceCardsQuestion">
        <H1>Wer ist das?</H1>
        <BUTTON style="width:140px;" onclick="solve();">Lösung</BUTTON>
    </DIV>
    <DIV id="FaceCardsResult"><H1 style="font-weight:bold;"></H1><H2></H2><BR>
        <H2>Bewerte, wie gut Du Dich an dieses Gesicht erinnern konntest:</H2><BR>
        <BUTTON style="width:140px; background:#F77;" onclick="showRandomEntry(1);">Keine Ahnung</BUTTON>
        <BUTTON style="width:140px; background:#FB7;" onclick="showRandomEntry(2);">Lange überlegt</BUTTON>
        <BUTTON style="width:140px; background:#FF7;" onclick="showRandomEntry(3);">Beinahe</BUTTON>
        <BUTTON style="width:140px; background:#BF7;" onclick="showRandomEntry(6);">Zuversichtlich</BUTTON>
        <BUTTON style="width:140px; background:#7F7;" onclick="showRandomEntry(9);">Sicher erkannt</BUTTON>
    </DIV>
</CENTER>
*/}

// https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API/Using_the_Web_Storage_API
var storage, prefix = "FaceCards_";
try {
    // detect availability and ensure functionality
    storage = window.localStorage;
    storage.setItem(prefix, prefix);
    storage.removeItem(prefix);
} catch(e) {
    storage = null;
}

var FaceCardsNumber, FaceCardsImg, FaceCardsQuestion, FaceCardsResult;

function solve() {
    FaceCardsQuestion.style.visibility = "hidden";
    FaceCardsResult  .style.visibility = "visible";
    viaXpath0("BUTTON[3]", FaceCardsResult).focus();
}

function Entry(src) {
    this.src = src;
    this.name = "";
    this.email = "";
    this.confidence = 0;
    this.hash = null;

    this.load = function() {
        // Falls lokaler Web Speicher verfügbar, versuche alten Lernfortschritt zu lesen
        if (storage) {
            this.hash = prefix + MD5_hexhash(src);
            this.confidence = parseInt(storage.getItem(this.hash));
            if (!this.confidence) {
                this.confidence = 0;
            }
        }
    }

    this.store = function() {
        if (storage && this.confidence > 0) {
            storage.setItem(this.hash, this.confidence);
        }
    }

    this.toString = function() {
        return this.name + "\n" + this.confidence + "\n" + this.email + "\n" + this.src;
    }
}

var entries = null, lesson = null, showing = false, rawCount = 0, enoughForToday = 0,
    hotspot = new Array(),
    hotspotSize = 20,
    confidenceThreshold = 9,
    confidenceModulo = 3;

// in Zufälliger Reihenfolge in Hotspot einfügen
function addToHotspot(index) {
    if (hotspot.length < hotspotSize && hotspot.indexOf(index) < 0) {
        if (0 == entries[index].confidence) {
            alert("may not enter into hotspot! " + index + "(" + entries[index].confidence + ")");
            var i = 1 / 0;
        }
        if (0 == hotspot.length) {
            hotspot.push(index);
        } else {
            var i = (Math.random() * hotspot.length) | 0;
            hotspot.push(hotspot[i]);
            hotspot[i] = index;
        }
//         alert("inserted i:" + index + " in h:" + hotspot.join());
    }
}

function cleanup() {
    // normalisiere auf das Minimum
    var min = confidenceThreshold;
    for (var i = 0; i < entries.length; i++) {
        if (0 == entries[i].confidence) {
            continue;
        }
        min = Math.min(min, entries[i].confidence);
        if (min < confidenceModulo) {
            break;
        }
    }
    if (storage) {
        // Alle Werte aus dem Speicher löschen, auch die, zu denen es keinen Eintrag mehr gibt.
        for(var propertyName in storage) {
            if (propertyName.substr(0,prefix.length) == prefix) {
                storage.removeItem(propertyName);
            }
        }
    }
    if (confidenceModulo < min) {
        min--;
        min = min - min % confidenceModulo;
    } else {
        min = 0;
    }
    for (var i = 0; i < entries.length; i++) {
        if (0 == entries[i].confidence) {
            continue;
        }
        entries[i].confidence -= min;
        entries[i].store();
        if (entries[i].confidence < confidenceThreshold) {
            addToHotspot(i);
        }
    }
}

function padding(zahl, length) {
    var string = "" + zahl;
    if (!length) {
        length = 2;
    }
    while (string.length < length) {
        // 2 Leerzeichen sind so breit wie eine Ziffer
        string = "  " + string;
    }
    return string;
}

function auswertung() {
    cleanup();
    var count = 0;
    if (storage) {
        for(var propertyName in storage) {
            if (propertyName.substr(0,prefix.length) == prefix) {
                count++;
            }
        }
    }

    // normalisiere Werte auf das Minimum
    var min = entries[0].confidence;
    var max = min;
    var w = "Werte: " + entries.length + "\n", map = new Object();
    for (var i = 0; i < entries.length; i++) {
        min = Math.min(min, entries[i].confidence);
        max = Math.max(max, entries[i].confidence);
        w += padding(entries[i].confidence) + (i % 10 == 9 ? ",\n" : ", ");
        map[entries[i].confidence] = (map[entries[i].confidence] ? map[entries[i].confidence] + 1 : 1);
    }

    // Verteilung zwischen min und max
    var v = "", c = 0, d = 0;
    for (var k in map) {
        v += padding(k) + "=" + padding(map[k]) + (++c % 5 == 0 ? ",\n" : ", ");
        d += map[k];
    }
    v = "\nVerteilung: " + c + " / " + d + "\n" + v;

    var h = "\nHotspot: " + hotspot.length + "\n";
    for (var i = 0; i < hotspot.length; i++) {
        h += padding(hotspot[i]) + (i % 10 == 9 ? ",\n" : ", ");
    }

    alert("Auswertung\nAngemeldet: " + rawCount + "\nmit Foto: " + entries.length
        + "\ngespeichert: " + count
        + "\nmin:" + min + " max:" + max + v.replace(/,\s$/, "\n") + w + h);
}

function showRandomEntry(lessonLearned) {
    // summiere den aktuellen Lernfortschritt
    lesson.confidence += lessonLearned;
    if (confidenceThreshold < lesson.confidence && lesson.confidence % confidenceModulo != 0) {
        lesson.confidence = lesson.confidence - lesson.confidence % confidenceModulo;
    }
    lesson.store();

    // einer der linken beiden Buttons
    // oder der mittlere Button und Gesamtsicherheit ist noch zu gering
    // -> versuche es im Hotspot unterzubringen
    var old = entries.indexOf(lesson);
    if (0 < lessonLearned) {
        if (lessonLearned < confidenceModulo
                || lessonLearned == confidenceModulo && lesson.confidence <= confidenceThreshold) {
            addToHotspot(old);
            enoughForToday--;
        } else {
            // aus Hotspot entfernen
            var hi = hotspot.indexOf(old);
            if (0 <= hi) {
                hotspot.splice(hi, 1);
            }
            enoughForToday++;
        }
        if (hotspotSize < Math.abs(enoughForToday)) {
            if (confirm("Genug für heute?")) {
                window.location.hash = "#";
            } else {
                enoughForToday = 0;
            }
        }
    }

    var j, category = '', hr = hotspot.length * Math.random() | 0;
    if (hotspotSize / 4 < hr && hotspot[hr] != old) {
        j = hotspot[hr];
        lesson = entries[j];
        category = 'Hotspot';
    } else {
        // wähle zufällig die nächste Herausforderung, möglichst mit geringerem Lernfortschritt
        for (var i = 0; ; i++) {
            j = (Math.random() * entries.length) | 0;
            var candidate = entries[j];
            if (candidate.confidence < lesson.confidence || i == confidenceThreshold) {
                // wähle geringeren Lernfortschritt oder akzeptiere den letzten Versuch
                lesson = candidate;
                category = 0 <= hotspot.indexOf(j) ? 'hotspot' : 'random';
                break;
            }
        }
    }
    FaceCardsNumber.innerHTML = "Punkte: " + lesson.confidence + ", Foto: " + j + " von " + entries.length
        + ", Auswahl: " + category + " bei " + hotspot.length + " "+ enoughForToday;
    FaceCardsImg.src = lesson.src;

    FaceCardsResult.style.visibility = "hidden";
    FaceCardsResult.firstChild.innerHTML = lesson.name;
    viaXpath0("H2", FaceCardsResult).innerHTML = lesson.email ? lesson.email : "";

    FaceCardsQuestion.style.visibility = "visible";
    viaXpath0("BUTTON", FaceCardsQuestion).focus();
    showing = true;
}

function collectData(myBody) {
    var img = viaXpath("//DIV[@class='profile-macro']/DIV/A/IMG[@class='userLogo logo']", myBody);
    rawCount += img.snapshotLength;
    for (var i = 0; i < img.snapshotLength; i++) {
        var current = img.snapshotItem(i);
        if (current.src.contains('/default.png')) {
            continue;
        }
        // current.style.border = "5px solid red";
        var entry = new Entry(current.src);
        entry.load();
        current.setAttribute("test", i);
        current = viaXpath0("parent::A/following-sibling::DIV[@class='values']/H4/A", current);
        entry.name = current.firstChild.data;
        current = viaXpath0("parent::H4/following-sibling::A", current);
        if (current && current.firstChild) {
            entry.email = current.firstChild.data;
        }
        entries.push(entry);
        if (0 < entry.confidence && entry.confidence < confidenceThreshold) {
            addToHotspot(entries.length - 1);
        }
    }
//     alert("collectData " + img.snapshotLength + " " + entries.length + " " + lesson);
}

function loadNextPage(link, direction) {
//     alert("loadNextPage " + link + " " + direction);
    var childDoc = new XMLHttpRequest();
    childDoc.open("GET", link, false);
    childDoc.send();
    childDoc = childDoc.responseText;
    childDoc = childDoc.substring(childDoc.indexOf("<body"), childDoc.lastIndexOf("</body>")).replace(/^.*>/, "");

    // weil eine HTML-Seite und kein XML abgefragt wird, weise den Inhalt einem dummy-Knoten zu
    var childBody = document.createElement("DIV");
    childBody.innerHTML = childDoc;
    collectData(childBody);
    navigateRecursive(childBody, direction);
}

function navigateRecursive(myBody, direction) {
//  var link = viaXpath0("//OL[@class='aui-nav-pagination']/LI[@class='" + direction + "']/A[@href]", myBody);
    var link = viaXpath0("//OL[@class]/LI[@class='" + direction + "']/A[@href]", myBody);
    if (!link) {
//      alert("No navigation for " + direction);
        return;
    }
    if (showing || entries.length == 0) {
        // erstes Foto wird bereits angezeigt oder noch keines gefunden -> suche synchron auf der nächsten Seite
        loadNextPage(link.href, direction);
    } else {
        // es wurde bereits ein Foto gefunden -> breche hier ab um es sofort anzuzeigen und lade die weiteren Seiten erst im Anschluss
        window.setTimeout("loadNextPage('" + link.href + "', '" + direction + "');", 0);
    }
}

function initialize() {
    // definiere CSS für die Lightbox
    var lightbox = document.createElement("STYLE");
    lightbox.type = "text/css";
    lightboxStyle = lightboxStyle.toString();
    lightboxStyle = lightboxStyle.substring(lightboxStyle.indexOf("/*") + 2, lightboxStyle.lastIndexOf("*/") - 1);
    lightbox.innerHTML = lightboxStyle;
    document.head.appendChild(lightbox);

    // füge die Lightbox selbst unten an das Dokument an (wird dank CSS später die anderen Inhalte überdecken)
    lightbox = document.createElement("DIV");
    lightbox.id = "FaceCards";
    lightbox.setAttribute("class", "lightbox");
    lightboxContent = lightboxContent.toString();
    lightboxContent = lightboxContent.substring(lightboxContent.indexOf("/*") + 2, lightboxContent.lastIndexOf("*/") - 1);
    lightbox.innerHTML = lightboxContent;
    document.body.appendChild(lightbox);

    // Esc key action
    $(lightbox).keyup(function(e) {
        if (e.keyCode == 27) {
            window.location.hash = "#";
        }
    });

    FaceCardsNumber   = document.getElementById("FaceCardsNumber");
    FaceCardsImg      = document.getElementById("FaceCardsImg");
    FaceCardsQuestion = document.getElementById("FaceCardsQuestion");
    FaceCardsResult   = document.getElementById("FaceCardsResult");

    // durchsuche die Original-Seite nach Fotos und sammle die Informationen
    collectData(document.body);
    navigateRecursive(document.body, "aui-nav-previous");
    navigateRecursive(document.body, "aui-nav-next");
}

function show() {
    enoughForToday = 0;
    // faule Initialisierung der Lightbox
    if (!entries) {
        entries = new Array();
        initialize();
    }
    if (entries.length == 0) {
        alert("Es wurden keine Fotos auf dieser Seite gefunden!");
        return;
    }

    // rufe die Lightbox auf
    window.location.hash = "#FaceCards";
    lesson = entries[0];
    showRandomEntry(0);
    window.setTimeout("cleanup();", 10 * 1000);
}

// Füge einen Link zum Aufruf der Initialisierung hinzu
var nav = viaXpath0("//DIV[@class='aui-navgroup-inner']/UL[@class='aui-nav']");
var link = document.createElement("li");
link.innerHTML = "<A href='javascript:show();' title='Zeige Karteikarten der Fotos'>Namen lernen</A>";
nav.appendChild(link);

// TODO Debug: rufe die Lightbox sofort auf und warte nicht auf den Klick
// initialize();
// show();

    // END injectContent()
}

// --------------------------------------------------------------------------------------------------------------------

// Message Digest MD5 - Hash Funktion zur Verschlüsselung personenbezogener Daten vor der Speicherung lokal im Browser
// http://www.onicos.com/staff/iz/amuse/javascript/expert/md5.txt
function injectMD5() {
    // BEGIN injectMD5()
/* md5.js - MD5 Message-Digest
 * Copyright (C) 1999,2002 Masanao Izumo <iz@onicos.co.jp>
 * Version: 2.0.0
 * LastModified: May 13 2002
 *
 * This program is free software.  You can redistribute it and/or modify
 * it without any warranty.  This library calculates the MD5 based on RFC1321.
 * See RFC1321 for more information and algorism.
 */

/* Interface:
 * md5_128bits = MD5_hash(data);
 * md5_hexstr = MD5_hexhash(data);
 */

/* ChangeLog
 * 2002/05/13: Version 2.0.0 released
 * NOTICE: API is changed.
 * 2002/04/15: Bug fix about MD5 length.
 */


//    md5_T[i] = parseInt(Math.abs(Math.sin(i)) * 4294967296.0);
var MD5_T = new Array(0x00000000, 0xd76aa478, 0xe8c7b756, 0x242070db,
		      0xc1bdceee, 0xf57c0faf, 0x4787c62a, 0xa8304613,
		      0xfd469501, 0x698098d8, 0x8b44f7af, 0xffff5bb1,
		      0x895cd7be, 0x6b901122, 0xfd987193, 0xa679438e,
		      0x49b40821, 0xf61e2562, 0xc040b340, 0x265e5a51,
		      0xe9b6c7aa, 0xd62f105d, 0x02441453, 0xd8a1e681,
		      0xe7d3fbc8, 0x21e1cde6, 0xc33707d6, 0xf4d50d87,
		      0x455a14ed, 0xa9e3e905, 0xfcefa3f8, 0x676f02d9,
		      0x8d2a4c8a, 0xfffa3942, 0x8771f681, 0x6d9d6122,
		      0xfde5380c, 0xa4beea44, 0x4bdecfa9, 0xf6bb4b60,
		      0xbebfbc70, 0x289b7ec6, 0xeaa127fa, 0xd4ef3085,
		      0x04881d05, 0xd9d4d039, 0xe6db99e5, 0x1fa27cf8,
		      0xc4ac5665, 0xf4292244, 0x432aff97, 0xab9423a7,
		      0xfc93a039, 0x655b59c3, 0x8f0ccc92, 0xffeff47d,
		      0x85845dd1, 0x6fa87e4f, 0xfe2ce6e0, 0xa3014314,
		      0x4e0811a1, 0xf7537e82, 0xbd3af235, 0x2ad7d2bb,
		      0xeb86d391);

var MD5_round1 = new Array(new Array( 0, 7, 1), new Array( 1,12, 2),
			   new Array( 2,17, 3), new Array( 3,22, 4),
			   new Array( 4, 7, 5), new Array( 5,12, 6),
			   new Array( 6,17, 7), new Array( 7,22, 8),
			   new Array( 8, 7, 9), new Array( 9,12,10),
			   new Array(10,17,11), new Array(11,22,12),
			   new Array(12, 7,13), new Array(13,12,14),
			   new Array(14,17,15), new Array(15,22,16));

var MD5_round2 = new Array(new Array( 1, 5,17), new Array( 6, 9,18),
			   new Array(11,14,19), new Array( 0,20,20),
			   new Array( 5, 5,21), new Array(10, 9,22),
			   new Array(15,14,23), new Array( 4,20,24),
			   new Array( 9, 5,25), new Array(14, 9,26),
			   new Array( 3,14,27), new Array( 8,20,28),
			   new Array(13, 5,29), new Array( 2, 9,30),
			   new Array( 7,14,31), new Array(12,20,32));

var MD5_round3 = new Array(new Array( 5, 4,33), new Array( 8,11,34),
			   new Array(11,16,35), new Array(14,23,36),
			   new Array( 1, 4,37), new Array( 4,11,38),
			   new Array( 7,16,39), new Array(10,23,40),
			   new Array(13, 4,41), new Array( 0,11,42),
			   new Array( 3,16,43), new Array( 6,23,44),
			   new Array( 9, 4,45), new Array(12,11,46),
			   new Array(15,16,47), new Array( 2,23,48));

var MD5_round4 = new Array(new Array( 0, 6,49), new Array( 7,10,50),
			   new Array(14,15,51), new Array( 5,21,52),
			   new Array(12, 6,53), new Array( 3,10,54),
			   new Array(10,15,55), new Array( 1,21,56),
			   new Array( 8, 6,57), new Array(15,10,58),
			   new Array( 6,15,59), new Array(13,21,60),
			   new Array( 4, 6,61), new Array(11,10,62),
			   new Array( 2,15,63), new Array( 9,21,64));

function MD5_F(x, y, z) { return (x & y) | (~x & z); }
function MD5_G(x, y, z) { return (x & z) | (y & ~z); }
function MD5_H(x, y, z) { return x ^ y ^ z;          }
function MD5_I(x, y, z) { return y ^ (x | ~z);       }

var MD5_round = new Array(new Array(MD5_F, MD5_round1),
			  new Array(MD5_G, MD5_round2),
			  new Array(MD5_H, MD5_round3),
			  new Array(MD5_I, MD5_round4));

function MD5_pack(n32) {
  return String.fromCharCode(n32 & 0xff) +
	 String.fromCharCode((n32 >>> 8) & 0xff) +
	 String.fromCharCode((n32 >>> 16) & 0xff) +
	 String.fromCharCode((n32 >>> 24) & 0xff);
}

function MD5_unpack(s4) {
  return  s4.charCodeAt(0)        |
	 (s4.charCodeAt(1) <<  8) |
	 (s4.charCodeAt(2) << 16) |
	 (s4.charCodeAt(3) << 24);
}

function MD5_number(n) {
  while (n < 0)
    n += 4294967296;
  while (n > 4294967295)
    n -= 4294967296;
  return n;
}

function MD5_apply_round(x, s, f, abcd, r) {
  var a, b, c, d;
  var kk, ss, ii;
  var t, u;

  a = abcd[0];
  b = abcd[1];
  c = abcd[2];
  d = abcd[3];
  kk = r[0];
  ss = r[1];
  ii = r[2];

  u = f(s[b], s[c], s[d]);
  t = s[a] + u + x[kk] + MD5_T[ii];
  t = MD5_number(t);
  t = ((t<<ss) | (t>>>(32-ss)));
  t += s[b];
  s[a] = MD5_number(t);
}

function MD5_hash(data) {
  var abcd, x, state, s;
  var len, index, padLen, f, r;
  var i, j, k;
  var tmp;

  state = new Array(0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476);
  len = data.length;
  index = len & 0x3f;
  padLen = (index < 56) ? (56 - index) : (120 - index);
  if(padLen > 0) {
    data += "\x80";
    for(i = 0; i < padLen - 1; i++)
      data += "\x00";
  }
  data += MD5_pack(len * 8);
  data += MD5_pack(0);
  len  += padLen + 8;
  abcd = new Array(0, 1, 2, 3);
  x    = new Array(16);
  s    = new Array(4);

  for(k = 0; k < len; k += 64) {
    for(i = 0, j = k; i < 16; i++, j += 4) {
      x[i] = data.charCodeAt(j) |
	    (data.charCodeAt(j + 1) <<  8) |
	    (data.charCodeAt(j + 2) << 16) |
	    (data.charCodeAt(j + 3) << 24);
    }
    for(i = 0; i < 4; i++)
      s[i] = state[i];
    for(i = 0; i < 4; i++) {
      f = MD5_round[i][0];
      r = MD5_round[i][1];
      for(j = 0; j < 16; j++) {
	MD5_apply_round(x, s, f, abcd, r[j]);
	tmp = abcd[0];
	abcd[0] = abcd[3];
	abcd[3] = abcd[2];
	abcd[2] = abcd[1];
	abcd[1] = tmp;
      }
    }

    for(i = 0; i < 4; i++) {
      state[i] += s[i];
      state[i] = MD5_number(state[i]);
    }
  }

  return MD5_pack(state[0]) +
	 MD5_pack(state[1]) +
	 MD5_pack(state[2]) +
	 MD5_pack(state[3]);
}

function MD5_hexhash(data) {
    var i, out, c;
    var bit128;

    bit128 = MD5_hash(data);
    out = "";
    for(i = 0; i < 16; i++) {
	c = bit128.charCodeAt(i);
	out += "0123456789abcdef".charAt((c>>4) & 0xf);
	out += "0123456789abcdef".charAt(c & 0xf);
    }
    return out;
}
    // END injectMD5()
}

// --------------------------------------------------------------------------------------------------------------------

// Wandle die Funktion in eine Zeichenkette und hänge sie an den Dokumenten-Kopf
injectMD5 = injectMD5.toString();
injectMD5 = injectMD5.substring(injectMD5.indexOf("{") + 1, injectMD5.lastIndexOf("}") - 1);

injectContent = injectContent.toString();
injectContent = injectContent.substring(injectContent.indexOf("{") + 1, injectContent.lastIndexOf("}") - 1);

var inPageScript = document.createElement("SCRIPT");
inPageScript.type = "text/javascript";
inPageScript.innerHTML = injectMD5 + "\n" + injectContent;
document.head.appendChild(inPageScript);

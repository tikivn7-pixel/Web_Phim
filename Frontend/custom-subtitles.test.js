const test = require('node:test'), assert = require('node:assert/strict'), S = require('./custom-subtitles.js');
test('SRT and VTT timestamps parse without interpreting cue HTML', () => {
 const cues = S.parse('\uFEFF1\r\n00:00:01,500 --> 00:00:03,000\r\nXin chào <img src=x onerror=evil()>\r\n\r\n2\r\n00:00:02,000 --> 00:00:04,000\r\nDòng hai');
 assert.equal(cues.length, 2); assert.equal(cues[0].text, 'Xin chào <img src=x onerror=evil()>');
 assert.equal(S.active(cues, 2), 'Xin chào <img src=x onerror=evil()>\nDòng hai');
 assert.equal(S.active(cues, 3, 2), ''); assert.equal(cues[0].start, 1.5);
 assert.equal(S.parse('WEBVTT\n\nNOTE metadata\nignore\n\nid\n00:02.000 --> 00:04.000 align:start\nViệt Nam')[0].start, 2);
});
test('invalid, empty, excessive or reversed subtitle data is rejected', () => {
 for (const value of ['', '1\n00:61:00,000 --> 00:62:00,000\nx', '1\n00:00:04,000 --> 00:00:02,000\nx', 'x'.repeat(S.MAX_BYTES + 1), Array.from({length:10001}, (_,i)=>`${i}\n00:00:01,000 --> 00:00:02,000\nx`).join('\n\n')]) assert.throws(() => S.parse(value));
});
test('subtitle preferences have bounded numeric values and a fixed style palette', () => {
 assert.deepEqual(S.preferences({offset:999,fontSize:-1,color:'url(evil)',background:'red'}),{offset:120,fontSize:16,color:'#ffffff',background:'#000000cc'});
 assert.equal(S.preferences({offset:NaN,fontSize:'bad'}).fontSize,24); assert.ok(Object.isFrozen(S.parse('00:00.000 --> 00:01.000\nx')));
});

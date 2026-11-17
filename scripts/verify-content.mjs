import assert from 'node:assert/strict';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join, resolve} from 'node:path';

const app = resolve(fileURLToPath(new URL('..', import.meta.url)));
const root = join(app, 'storage/app/private/fangschool');
const read = (name) => JSON.parse(readFileSync(join(root, name), 'utf8'));
const manifest = read('manifest.json');
const validLevel = (number) => [1, 2, 3, 4].includes(number);
const checkAsset = (folder, filename) => {
  const pattern = folder === 'audio' ? /^[a-z0-9-]+\.mp3$/ : /^[A-Za-z0-9-]+\.(pdf|webp)$/;
  assert(pattern.test(filename), filename);
  assert(statSync(join(root, folder, filename)).size > 0, filename);
  assert(!existsSync(join(app, 'public', folder, filename)), 'Private asset became public: ' + filename);
};

for (const type of ['audio', 'exams']) {
  for (const [filename, level] of Object.entries(manifest[type])) {
    assert(validLevel(level), filename);
    checkAsset(type, filename);
  }
}
for (const level of [1, 2, 3, 4]) {
  const content = read('learning/' + level + '.json');
  const exams = content.examCatalog?.papers ?? [];
  assert(content.lessons.length > 0);
  assert.equal(exams.length, [15, 12, 11, 22][level - 1]);
  if (level === 4) {
    const groups = content.examCatalog.practiceSeries;
    assert.deepEqual(groups.map(group => group.key), ['hanban', 'tinhgiang']);
    for (const group of groups) {
      const papers = exams.filter(exam => exam.group === group.key);
      assert.deepEqual(papers.map(paper => paper.code), Array.from({length: group.key === 'hanban' ? 12 : 10}, (_,i) => 'PH' + (i+1)));
      for (const paper of papers) {
        const size = group.key === 'hanban' ? 100 : 16;
        assert.equal(paper.answerKey.length, size);
        assert.equal(paper.pages.at(-1)[2], size);
        if (group.key === 'hanban') {
          assert.equal(paper.answerKey.filter(value => value !== null).length, 95);
          assert.equal(Object.keys(paper.writingExamples).length, 5);
        }
      }
    }
  }
  for (const file of Object.values(content.audioFiles)) assert(manifest.audio[file] <= level, file);
  for (const voice of Object.values(content.flashcardAudio.readers)) {
    for (const file of Object.values(voice)) assert(manifest.audio[file] <= level, file);
  }
  for (const exam of exams) {
    assert.match(exam.title, /PH[0-9]+/);
    if (exam.audio) assert.equal(manifest.audio[exam.audio.split('/').at(-1)], level);
    assert.equal(manifest.exams[exam.pdf.split('/').at(-1)], level);
    for (const [page] of exam.pages) assert.equal(manifest.exams[exam.id + '-p' + page + '.webp'], level);
  }
  console.log('HSK ' + level + ': ' + content.lessons.length + ' mục học, ' + exams.length + ' đề PH');
}
console.log(Object.keys(manifest.audio).length + ' file MP3 và ' + Object.keys(manifest.exams).length + ' file tài liệu đã được kiểm tra.');

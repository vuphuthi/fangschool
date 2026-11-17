import assert from 'node:assert/strict';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join, resolve} from 'node:path';

const app = resolve(fileURLToPath(new URL('..', import.meta.url)));
const root = join(app, 'storage/app/private/fangschool');
const read = (name) => JSON.parse(readFileSync(join(root, name), 'utf8'));
const manifest = read('manifest.json');
const counts = {1: 15, 2: 12, 3: 11, 4: 22, 31: 1, 32: 1, 41: 0, 42: 0};
const tracks = {41: 'factory', 42: 'office'};
const checkAsset = (folder, filename) => {
  const pattern = folder === 'audio' ? /^[a-z0-9-]+\.mp3$/ : /^[A-Za-z0-9-]+\.(pdf|webp)$/;
  assert(pattern.test(filename), filename);
  assert(statSync(join(root, folder, filename)).size > 0, filename);
  assert(!existsSync(join(app, 'public', folder, filename)), 'Private asset became public: ' + filename);
};

for (const type of ['audio', 'exams']) {
  for (const [filename, level] of Object.entries(manifest[type])) {
    assert([1, 2, 3, 4].includes(level) || (type === 'audio' && level === 99 && manifest.workplaceAudio[filename]?.length), filename);
    checkAsset(type, filename);
  }
}
for (const level of Object.keys(counts).map(Number)) {
  const content = read('learning/' + level + '.json');
  const exams = content.examCatalog?.papers ?? [];
  assert(content.lessons.length > 0);
  assert.equal(exams.length, counts[level]);
  const track = tracks[level];
  const canPlay = (file) => track ? manifest.workplaceAudio[file]?.includes(track) :
    Number.isInteger(manifest.audio[file]) && manifest.audio[file] <= (level > 30 ? level - 30 : level);
  if (track) {
    assert.equal(content.lessons.length, level === 41 ? 21 : 15);
    assert.equal(content.lessons.filter(lesson => lesson.extension).length, 8);
    assert.equal(content.lessons.flatMap(lesson => lesson.questions).filter(question => question.kind === 2).length,
      level === 41 ? 54 : 35);
  }
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
  for (const file of [...Object.values(content.audioFiles), ...Object.values(content.flashcardAudio.samples)]) {
    assert(canPlay(file), file);
  }
  for (const voice of Object.values(content.flashcardAudio.readers)) {
    for (const file of Object.values(voice)) assert(canPlay(file), file);
  }
  for (const exam of exams) {
    assert.match(exam.title, /PH[0-9]+/);
    if (exam.audio) assert(canPlay(exam.audio.split('/').at(-1)), exam.audio);
    if (exam.pdf) {
      assert.equal(manifest.exams[exam.pdf.split('/').at(-1)], level);
      for (const [page] of exam.pages) assert.equal(manifest.exams[exam.id + '-p' + page + '.webp'], level);
    } else {
      assert([31, 32].includes(level));
      assert.equal(exam.answerKey.length, 20);
      assert.equal(Object.keys(exam.prompts).length, 20);
      assert.equal(Object.keys(exam.recordings).length, 10);
      for (const clip of Object.values(exam.recordings)) assert(canPlay(clip.split('/').at(-1)), clip);
    }
  }
  console.log('Khóa ' + level + ': ' + content.lessons.length + ' mục học, ' + exams.length + ' đề PH');
}
console.log(Object.keys(manifest.audio).length + ' file MP3 và ' + Object.keys(manifest.exams).length + ' file tài liệu đã được kiểm tra.');

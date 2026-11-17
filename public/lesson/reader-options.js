export const flashcardReaders=Object.freeze({
 current:'Giọng hiện tại',
 a:'Giọng A',
 b:'Giọng B'
});

const alternateReadings={
 '还':['huán'],
 '教':['jiāo'],
 '只':['zhī'],
 '长':['cháng'],
 '为':['wéi'],
 '着':['zhāo','zhuó'],
 '得':['dé','děi']
};

export function flashcardReaderKey({zh,pinyin}){
 const reading=typeof pinyin==='string'?pinyin.trim().toLowerCase():'';
 return Object.hasOwn(alternateReadings,zh)&&alternateReadings[zh].includes(reading)?zh+'（'+reading+'）':zh;
}

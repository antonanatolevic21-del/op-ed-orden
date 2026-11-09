'use strict';

const testPresetOptions = {
  shuffleOptions: {
    text: 'Перемешивать варианты',
    action: 'Отключать перемешивание вариантов',
    defaultOn: true,
  },
  kingOfTheHill: {
    text: 'Царь горы',
    action: 'Отключать режим «Царь горы»',
    defaultOn: true,
  },
  randomQuestions: { text: 'Выводить вопросы в случайном порядке' },
  randomAnswers: { text: 'Выводить ответы в случайном порядке' },
  showCorrect: { text: 'Показать правильные ответы после прохождения' },
  hideCorrectness: { text: 'Скрыть правильность ответов после прохождения' },
  noBack: { text: 'Отключить возможность возвращаться на шаг назад' },
  strictOrder: { text: 'Ответы должны даваться в строгом порядке' },
  erotic: { text: 'Эротические материалы', visibility: true },
  profanity: { text: 'Ненормативная лексика', visibility: true },
};

const testPresetFormats = [
  { id: 'tournament', name: 'Турнир', options: ['shuffleOptions', 'kingOfTheHill'] },
  {
    id: 'quiz',
    name: 'Викторина',
    options: ['randomQuestions', 'randomAnswers', 'showCorrect', 'hideCorrectness', 'noBack'],
  },
  {
    id: 'identity',
    name: 'Идентификация и диаграмма',
    options: ['randomQuestions', 'randomAnswers', 'noBack'],
  },
  { id: 'challenge', name: 'Челлендж', options: ['showCorrect', 'strictOrder'] },
  { id: 'tierlist', name: 'Тирлист', options: ['shuffleOptions'] },
].map(format => ({ ...format, options: [...format.options, 'erotic', 'profanity'] }));

function testPresetKey(format, option) {
  return `testPreset.${format}.${option}`;
}

function testPresetDefaults(formats = testPresetFormats) {
  const defaults = {};
  for (const format of formats) {
    for (const option of format.options) defaults[testPresetKey(format.id, option)] = false;
  }
  return defaults;
}

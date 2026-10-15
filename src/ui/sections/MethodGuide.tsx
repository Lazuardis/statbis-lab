import { useState } from 'preact/hooks';
import { useT, type MessageKey } from '../../i18n/i18n';
import { Modal } from '../shell/Modal';

/** The course's method table as a two-step picker: question, then data → method, tab, what to tick. */
interface Answer {
  method: MessageKey;
  where: MessageKey;
  tick: MessageKey;
  route: string;
}

interface Question {
  key: MessageKey;
  options: { data: MessageKey; answer: Answer }[];
}

const QUESTIONS: Question[] = [
  {
    key: 'guide.q.estimate',
    options: [
      { data: 'guide.d.metric', answer: { method: 'guide.m.ciMean', where: 'guide.w.describe', tick: 'guide.t.oneMetric', route: 'describe' } },
      { data: 'guide.d.nominal', answer: { method: 'guide.m.ciProp', where: 'guide.w.describeProp', tick: 'guide.t.oneNominal', route: 'describe' } },
    ],
  },
  {
    key: 'guide.q.target',
    options: [
      { data: 'guide.d.metric', answer: { method: 'guide.m.oneSample', where: 'guide.w.tests', tick: 'guide.t.oneMetric', route: 'tests' } },
      { data: 'guide.d.nominal', answer: { method: 'guide.m.oneProp', where: 'guide.w.tests', tick: 'guide.t.oneNominal', route: 'tests' } },
    ],
  },
  {
    key: 'guide.q.twoGroups',
    options: [
      { data: 'guide.d.metricGroups', answer: { method: 'guide.m.welch', where: 'guide.w.tests', tick: 'guide.t.metricGroup', route: 'tests' } },
      { data: 'guide.d.binary', answer: { method: 'guide.m.twoProp', where: 'guide.w.tests', tick: 'guide.t.twoBinary', route: 'tests' } },
    ],
  },
  {
    key: 'guide.q.beforeAfter',
    options: [{ data: 'guide.d.metric', answer: { method: 'guide.m.paired', where: 'guide.w.tests', tick: 'guide.t.twoMetric', route: 'tests' } }],
  },
  {
    key: 'guide.q.manyGroups',
    options: [{ data: 'guide.d.metric', answer: { method: 'guide.m.anova', where: 'guide.w.tests', tick: 'guide.t.metricGroup', route: 'tests' } }],
  },
  {
    key: 'guide.q.twoCategorical',
    options: [{ data: 'guide.d.nominal', answer: { method: 'guide.m.chi', where: 'guide.w.tests', tick: 'guide.t.twoNominal', route: 'tests' } }],
  },
  {
    key: 'guide.q.twoNumeric',
    options: [{ data: 'guide.d.metric', answer: { method: 'guide.m.corr', where: 'guide.w.corr', tick: 'guide.t.corr', route: 'correlation' } }],
  },
];

export function MethodGuide(props: { onClose: () => void }) {
  const t = useT();
  const [q, setQ] = useState(0);
  const [o, setO] = useState(0);
  const question = QUESTIONS[q]!;
  const option = question.options[Math.min(o, question.options.length - 1)]!;
  const a = option.answer;
  return (
    <Modal title={t('guide.title')} size="large" onClose={props.onClose}>
      <div class="guide">
        <fieldset class="opt-group">
          <legend>{t('guide.step1')}</legend>
          {QUESTIONS.map((qq, i) => (
            <label key={qq.key} class="radio">
              <input
                type="radio"
                name="guide-q"
                checked={q === i}
                onChange={() => {
                  setQ(i);
                  setO(0);
                }}
              />
              <span>{t(qq.key)}</span>
            </label>
          ))}
        </fieldset>
        {question.options.length > 1 && (
          <fieldset class="opt-group">
            <legend>{t('guide.step2')}</legend>
            {question.options.map((op, i) => (
              <label key={op.data} class="radio">
                <input type="radio" name="guide-d" checked={o === i} onChange={() => setO(i)} />
                <span>{t(op.data)}</span>
              </label>
            ))}
          </fieldset>
        )}
        <dl class="guide-answer">
          <dt>{t('guide.method')}</dt>
          <dd>
            <strong>{t(a.method)}</strong>
          </dd>
          <dt>{t('guide.where')}</dt>
          <dd>{t(a.where)}</dd>
          <dt>{t('guide.tick')}</dt>
          <dd>{t(a.tick)}</dd>
        </dl>
        <button
          type="button"
          class="btn btn-primary"
          onClick={() => {
            location.hash = `#/${a.route}`;
            props.onClose();
          }}
        >
          {t('guide.open')}
        </button>
        <a class="link-btn" href="#/guides" onClick={props.onClose}>
          {t('guides.open')}
        </a>
      </div>
    </Modal>
  );
}

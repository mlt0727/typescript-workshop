import { useId, useState } from 'react';
import type { Lesson, QuizQuestion } from '../../content/types.ts';
import { progressStore, useProgress } from '../../storage/store.ts';
import { Icon } from '../../ui/Icon.tsx';

function Question({ lesson, q, index }: { lesson: Lesson; q: QuizQuestion; index: number }) {
  const saved = useProgress((s) => s.state.lessons[lesson.id]?.quiz[q.id]);
  const [selected, setSelected] = useState<string[]>(saved?.selected ?? []);
  const [submitted, setSubmitted] = useState(saved !== undefined);
  const name = useId();
  const correctIds = q.options.filter((o) => o.correct).map((o) => o.id);
  const isCorrect = selected.length === correctIds.length && selected.every((s) => correctIds.includes(s));

  const toggle = (id: string) => {
    if (submitted) return;
    setSelected((cur) => (q.type === 'single' ? [id] : cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id].sort()));
  };

  const submit = () => {
    if (selected.length === 0) return;
    setSubmitted(true);
    progressStore.recordQuizAnswer(lesson.id, lesson.version, q.id, selected, isCorrect);
  };

  return (
    <fieldset className={`quiz-question ${submitted ? (isCorrect ? 'correct' : 'incorrect') : ''}`}>
      <legend>
        <span className="quiz-index">第 {index + 1} 题</span>
        <span className="badge">{q.type === 'single' ? '单选' : '多选（选出所有正确项）'}</span>
        {saved?.everCorrect && <span className="badge badge-ok">曾答对</span>}
      </legend>
      <div className="prose" dangerouslySetInnerHTML={{ __html: q.promptHtml }} />
      <ul className="quiz-options">
        {q.options.map((o) => {
          const checked = selected.includes(o.id);
          const verdict = submitted ? (o.correct ? 'right' : checked ? 'wrong' : '') : '';
          return (
            <li key={o.id} className={`quiz-option ${verdict} ${checked ? 'checked' : ''}`}>
              <label>
                <input
                  type={q.type === 'single' ? 'radio' : 'checkbox'}
                  name={name}
                  checked={checked}
                  disabled={submitted}
                  onChange={() => toggle(o.id)}
                />
                <span className="quiz-option-text" dangerouslySetInnerHTML={{ __html: o.html }} />
                {submitted && o.correct && (
                  <span className="verdict">
                    <Icon name="check" /> 正确选项
                  </span>
                )}
                {submitted && !o.correct && checked && (
                  <span className="verdict">
                    <Icon name="cross" /> 你选了它，但它不对
                  </span>
                )}
              </label>
              {submitted && (checked || o.correct) && <div className="quiz-explain prose" dangerouslySetInnerHTML={{ __html: o.explainHtml }} />}
            </li>
          );
        })}
      </ul>
      {submitted && q.options.some((o) => !o.correct && !selected.includes(o.id)) && (
        <details className="quiz-more">
          <summary>查看其余选项为什么不对</summary>
          {q.options
            .filter((o) => !o.correct && !selected.includes(o.id))
            .map((o) => (
              <div key={o.id} className="quiz-explain prose">
                <span dangerouslySetInnerHTML={{ __html: o.html }} />
                <span dangerouslySetInnerHTML={{ __html: o.explainHtml }} />
              </div>
            ))}
        </details>
      )}
      {submitted && q.explainHtml && <div className="quiz-explain prose" dangerouslySetInnerHTML={{ __html: q.explainHtml }} />}
      <div className="quiz-actions">
        {!submitted ? (
          <button type="button" className="btn btn-primary btn-small" onClick={submit} disabled={selected.length === 0}>
            提交答案
          </button>
        ) : (
          <>
            <span className="quiz-result" role="status">
              <Icon name={isCorrect ? 'check' : 'cross'} /> {isCorrect ? '回答正确' : '回答不正确，看看上面的解释'}
            </span>
            <button type="button" className="btn btn-small" onClick={() => { setSubmitted(false); setSelected([]); }}>
              重新作答
            </button>
          </>
        )}
      </div>
    </fieldset>
  );
}

export function Quiz({ lesson }: { lesson: Lesson }) {
  if (lesson.quiz.length === 0) return null;
  return (
    <section className="quiz" aria-labelledby="quiz-title" data-block="quiz">
      <h2 id="quiz-title">小测验</h2>
      <p className="muted">选错也会给出原因；可以重新作答。</p>
      {lesson.quiz.map((q, i) => (
        <Question key={q.id} lesson={lesson} q={q} index={i} />
      ))}
    </section>
  );
}

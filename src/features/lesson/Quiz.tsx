import { useId, useState } from 'react';
import type { Lesson, QuizQuestion } from '../../content/types.ts';
import { progressStore, useProgress } from '../../storage/store.ts';
import { Icon } from '../../ui/Icon.tsx';

/**
 * 一道测验题。选错时只解释学习者选的那几项，不直接标出正确答案：
 * 可以“再试一次”（保留刚才的选择，接着改），也可以“看答案”。答对或看了答案之后，才显示全部选项的解释。
 */
function Question({ lesson, q, index }: { lesson: Lesson; q: QuizQuestion; index: number }) {
  const saved = useProgress((s) => s.state.lessons[lesson.id]?.quiz[q.id]);
  const [selected, setSelected] = useState<string[]>(saved?.selected ?? []);
  const [submitted, setSubmitted] = useState(saved !== undefined);
  const [revealed, setRevealed] = useState(false);
  const name = useId();
  const correctIds = q.options.filter((o) => o.correct).map((o) => o.id);
  const isCorrect = selected.length === correctIds.length && selected.every((s) => correctIds.includes(s));
  // 全部选项的对错和解释：答对了，或者学习者要求看答案
  const showAll = submitted && (isCorrect || revealed);
  const pickedWrong = selected.some((s) => !correctIds.includes(s));
  const missedRight = correctIds.some((c) => !selected.includes(c));

  const toggle = (id: string) => {
    if (submitted) return;
    setSelected((cur) => (q.type === 'single' ? [id] : cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id].sort()));
  };

  const submit = () => {
    if (selected.length === 0) return;
    setSubmitted(true);
    setRevealed(false);
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
          // 没有显示全部答案时，只评价学习者选了的选项
          const verdict = !submitted ? '' : checked ? (o.correct ? 'right' : 'wrong') : showAll && o.correct ? 'right' : '';
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
                {verdict === 'right' && (
                  <span className="verdict">
                    <Icon name="check" /> {checked ? (showAll ? '正确选项' : '这一项选对了') : '正确选项（你没有选）'}
                  </span>
                )}
                {verdict === 'wrong' && (
                  <span className="verdict">
                    <Icon name="cross" /> 你选了它，但它不对
                  </span>
                )}
              </label>
              {verdict !== '' && <div className="quiz-explain prose" dangerouslySetInnerHTML={{ __html: o.explainHtml }} />}
            </li>
          );
        })}
      </ul>
      {showAll && q.options.some((o) => !o.correct && !selected.includes(o.id)) && (
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
      {showAll && q.explainHtml && <div className="quiz-explain prose" dangerouslySetInnerHTML={{ __html: q.explainHtml }} />}
      <div className="quiz-actions">
        {!submitted ? (
          <button type="button" className="btn btn-primary btn-small" onClick={submit} disabled={selected.length === 0}>
            提交答案
          </button>
        ) : isCorrect ? (
          <>
            <span className="quiz-result" role="status">
              <Icon name="check" /> 回答正确
            </span>
            <button type="button" className="btn btn-small" onClick={() => { setSubmitted(false); setSelected([]); }}>
              重新作答
            </button>
          </>
        ) : (
          <>
            <span className="quiz-result" role="status">
              <Icon name="cross" /> 回答不正确
              {!revealed &&
                (q.type === 'single'
                  ? '：看看上面的解释，再选一次'
                  : pickedWrong && missedRight
                    ? '：有选错的，也有正确的没选上'
                    : pickedWrong
                      ? '：有一项选错了'
                      : '：还有正确的选项没选上')}
            </span>
            <button type="button" className="btn btn-primary btn-small" onClick={() => { setSubmitted(false); setRevealed(false); if (q.type === 'single') setSelected([]); }}>
              再试一次
            </button>
            {!revealed && (
              <button type="button" className="btn btn-small btn-ghost" onClick={() => setRevealed(true)}>
                看答案
              </button>
            )}
          </>
        )}
      </div>
    </fieldset>
  );
}

export function Quiz({ lesson }: { lesson: Lesson }) {
  if (lesson.quiz.length === 0) return null;
  return (
    <section className="quiz" aria-labelledby="quiz-title" data-block="quiz" tabIndex={-1}>
      <h2 id="quiz-title">小测验</h2>
      <p className="muted">选错了会解释你选的选项，可以再试；全部答对才算完成。</p>
      {lesson.quiz.map((q, i) => (
        <Question key={q.id} lesson={lesson} q={q} index={i} />
      ))}
    </section>
  );
}

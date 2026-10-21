/** 在浏览器中把一道练习下载为本地项目（zip 中的文件都放在一个以项目名命名的文件夹里） */
import type { Exercise, Lesson } from '../../content/types.ts';
import { buildLocalProject, localProjectName } from './local-project.ts';
import mockFetchSource from './local-mock-fetch.ts?raw';
import { createZip } from './zip.ts';

export function downloadLocalProject(lesson: Lesson, exercise: Exercise, files: Readonly<Record<string, string>>) {
  const name = localProjectName(lesson.id, exercise.id);
  const project = buildLocalProject({
    lessonId: lesson.id,
    exerciseId: exercise.id,
    title: exercise.title,
    mode: exercise.mode,
    entry: exercise.entry,
    files,
    overrides: exercise.compiler.overrides,
    fixtures: exercise.fixtures,
    mockFetchSource,
    lessonUrl: new URL(`learn/${lesson.id}`, new URL(import.meta.env.BASE_URL, location.origin)).href,
  });
  const zip = createZip(Object.fromEntries(Object.entries(project).map(([path, content]) => [`${name}/${path}`, content])));
  const url = URL.createObjectURL(new Blob([zip], { type: 'application/zip' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name}.zip`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

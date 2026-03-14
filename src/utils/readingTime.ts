// ~200 words/minute (average Spanish reading speed)
export function readingTime(content: string): number {
  const words = content.trim().split(/[\s\n\r\t]+/).length;
  return Math.max(1, Math.ceil(words / 200));
}

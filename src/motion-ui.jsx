// Inline adaptation of Aceternity's Text Generate Effect, retaining normal text wrapping.
export function TextGenerate({ children }) {
  return children.split(' ').map((word, index) =>
    <span key={index} className="generated-word" style={{ '--word': index }}>{word} </span>)
}

// Renders a participant-authored justification for the conductor.
// Single-choice / text justifications are stored as a plain string.
// Multiple-choice justifications are stored as a JSON array of { option, reason } (one per option).
// This component handles both shapes (and is backward compatible with old plain-string data).

interface JustificationDisplayProps {
  justification?: string | null;
  className?: string;
}

type OptionReason = { option?: string; reason?: string };

function parsePerOption(justification: string): OptionReason[] | null {
  try {
    const parsed = JSON.parse(justification);
    if (Array.isArray(parsed) && parsed.every((e) => e && typeof e === "object")) {
      return parsed as OptionReason[];
    }
  } catch {
    // not JSON → treat as plain string
  }
  return null;
}

export function JustificationDisplay({ justification, className }: JustificationDisplayProps) {
  if (!justification || !justification.trim()) return null;

  const perOption = parsePerOption(justification);

  return (
    <div className={`p-3 rounded bg-amber-50 border border-amber-200 ${className || ""}`}>
      <div className="text-sm font-medium text-amber-800 mb-1">Justification</div>
      {perOption ? (
        <ul className="space-y-1">
          {perOption.map((e, i) => (
            <li key={i} className="text-sm text-gray-700">
              <span className="font-medium">{e.option || `Option ${i + 1}`}:</span>{" "}
              <span className="whitespace-pre-wrap">{e.reason?.trim() || <em className="text-gray-400">no reason given</em>}</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="text-sm text-gray-700 whitespace-pre-wrap">{justification}</div>
      )}
    </div>
  );
}

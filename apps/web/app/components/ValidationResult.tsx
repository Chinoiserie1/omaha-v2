interface ValidationResultProps {
  result: string | null;
}

export function ValidationResult({ result }: ValidationResultProps) {
  if (!result) return null;

  return (
    <pre className="mt-4 p-4 bg-gray-100 rounded-md overflow-auto text-sm">
      {result}
    </pre>
  );
}

import React, { useEffect } from "react";
import { Box, render, Text, useApp } from "ink";

const ACCENT = "#3E57C4";

export interface ResultViewProps {
  title: string;
  lines: string[];
  error?: boolean;
}

export function ResultView({ title, lines, error = false }: ResultViewProps): React.ReactElement {
  const { exit } = useApp();
  useEffect(() => {
    const timer = setTimeout(exit, 0);
    return () => clearTimeout(timer);
  }, [exit]);

  return (
    <Box borderColor={error ? "red" : ACCENT} borderStyle="round" flexDirection="column" paddingX={1}>
      <Text bold color={error ? "red" : ACCENT}>{title}</Text>
      {lines.map((line, index) => <Text key={index}>{line}</Text>)}
    </Box>
  );
}

export async function renderResult(props: ResultViewProps): Promise<void> {
  const instance = render(<ResultView {...props} />);
  await instance.waitUntilExit();
}

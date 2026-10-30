export interface WidgetProps {
  title: string;
  count: number;
}

export default function Widget({ title, count }: WidgetProps) {
  return <p>{title}: {count}</p>;
}

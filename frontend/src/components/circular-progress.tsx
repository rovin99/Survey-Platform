interface CircularProgressProps {
  value: number;
  size?: number;
  strokeWidth?: number;
  label: string;
  sublabel: string;
}

export function CircularProgress({ value, size = 120, strokeWidth = 8, label, sublabel }: CircularProgressProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="flex items-center space-x-4 p-6 bg-card rounded-lg">
      <div className="relative">
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-muted-foreground/20"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="text-primary transition-all duration-500 ease-in-out"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xl font-bold">{value}%</span>
        </div>
      </div>
      <div className="space-y-1">
        <h3 className="font-medium">{label}</h3>
        <p className="text-sm text-muted-foreground">{sublabel}</p>
      </div>
    </div>
  );
}

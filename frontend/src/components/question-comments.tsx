interface QuestionCommentsProps {
	comments: Comment[];
}

export function QuestionComments({ comments }: QuestionCommentsProps) {
	return (
		<div className="space-y-4">
			{comments.map((comment) => (
				<div key={comment.id} className="text-sm">
					<div className="flex items-center space-x-2">
						<span className="font-medium">{comment.author}</span>
						<span className="text-muted-foreground">{comment.timestamp}</span>
					</div>
					<p className="mt-1 text-muted-foreground">{comment.text}</p>
				</div>
			))}
		</div>
	);
}

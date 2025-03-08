import * as React from "react";

import { cn } from "@/lib/utils";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";

const Select = SelectPrimitive.Root;

interface SelectTriggerProps
	extends React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger> {
	className?: string;
	children?: React.ReactNode;
}

// to open the dropdown
const SelectTrigger = React.forwardRef<HTMLButtonElement, SelectTriggerProps>(
	({ className, children, ...props }, ref) => (
		<SelectPrimitive.Trigger
			ref={ref}
			className={cn(
				"flex w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
				className,
			)}
			{...props}
		>
			{children}
			<ChevronDown className="ml-2 h-4 w-4 opacity-50" />
		</SelectPrimitive.Trigger>
	),
);
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName; //same name to the component as radix element for consistency

// dropdown container
const SelectContent = React.forwardRef<
	HTMLDivElement,
	React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, ...props }, ref) => (
	<SelectPrimitive.Portal>
		<SelectPrimitive.Content
			ref={ref}
			className={cn(
				"relative z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 shadow-md",
				className,
			)}
			{...props}
		>
			<SelectPrimitive.Viewport>{children}</SelectPrimitive.Viewport>
		</SelectPrimitive.Content>
	</SelectPrimitive.Portal>
));
SelectContent.displayName = SelectPrimitive.Content.displayName;

interface SelectItemProps
	extends React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item> {
	className?: string;
	children?: React.ReactNode;
}
// individual option inside the dropdown
const SelectItem = React.forwardRef<HTMLDivElement, SelectItemProps>(
	({ className, children, ...props }, ref) => (
		<SelectPrimitive.Item
			ref={ref}
			className={cn(
				"relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent focus:text-accent-foreground",
				className,
			)}
			{...props}
		>
			<SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
			<SelectPrimitive.ItemIndicator className="absolute right-2 flex items-center justify-center">
				<Check className="h-4 w-4" />
			</SelectPrimitive.ItemIndicator>
		</SelectPrimitive.Item>
	),
);
SelectItem.displayName = SelectPrimitive.Item.displayName;

const SelectValue = SelectPrimitive.Value; //value of the selected item

export { Select, SelectTrigger, SelectContent, SelectItem, SelectValue };

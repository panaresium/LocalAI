using System.Diagnostics;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
using System.Runtime.Versioning;
using System.Text;
using System.Text.Json;
using System.Windows.Automation;

namespace HermesLocalAI.WindowsBroker;

[SupportedOSPlatform("windows")]
internal static class Program
{
    private const uint MouseEventLeftDown = 0x0002;
    private const uint MouseEventLeftUp = 0x0004;
    private static readonly Dictionary<string, string> AllowedChords = new(StringComparer.OrdinalIgnoreCase)
    {
        ["TAB"] = "{TAB}",
        ["ENTER"] = "{ENTER}",
        ["ESC"] = "{ESC}",
        ["CTRL+A"] = "^a",
        ["CTRL+C"] = "^c",
        ["CTRL+V"] = "^v"
    };

    private static int Main(string[] args)
    {
        if (args.Length == 0 || args[0] is "--help" or "-h")
        {
            WriteJson(new
            {
                commands = new[] {
                    "window.list",
                    "ui.get_tree",
                    "screen.capture",
                    "ui.highlight",
                    "ui.invoke",
                    "ui.set_value",
                    "ui.select",
                    "ui.toggle",
                    "keyboard.type",
                    "keyboard.chord",
                    "mouse.click",
                    "emergency.stop"
                },
                milestone = 8,
                observeOnly = false,
                activeCommandsRequireApprovalToken = true
            });
            return 0;
        }

        return args[0] switch
        {
            "window.list" => ListWindows(),
            "ui.get_tree" => GetUiTree(args),
            "screen.capture" => CaptureScreen(args, "screen.capture", null),
            "ui.highlight" => HighlightUiElement(args),
            "ui.invoke" => InvokeUiElement(args),
            "ui.set_value" => SetUiValue(args),
            "ui.select" => SelectUiElement(args),
            "ui.toggle" => ToggleUiElement(args),
            "keyboard.type" => TypeKeyboardText(args),
            "keyboard.chord" => SendKeyboardChord(args),
            "mouse.click" => ClickMouse(args),
            "emergency.stop" => EmergencyStop(),
            _ => Error($"Unsupported command '{args[0]}'.")
        };
    }

    private static int ListWindows()
    {
        var windows = new List<object>();
        EnumWindows((nint handle, nint parameter) =>
        {
            if (!IsWindowVisible(handle))
            {
                return true;
            }

            var title = GetWindowText(handle);
            if (string.IsNullOrWhiteSpace(title))
            {
                return true;
            }

            _ = GetWindowThreadProcessId(handle, out var processId);
            string? processName = null;
            try
            {
                processName = Process.GetProcessById(processId).ProcessName;
            }
            catch
            {
                processName = null;
            }

            windows.Add(new
            {
                handle = handle.ToInt64(),
                title,
                className = GetClassName(handle),
                processId,
                processName,
                bounds = TryGetWindowBounds(handle)
            });
            return true;
        }, 0);

        WriteJson(new
        {
            command = "window.list",
            observeOnly = true,
            capturedAt = DateTimeOffset.UtcNow.ToString("o"),
            windows
        });
        return 0;
    }

    private static int GetUiTree(string[] args)
    {
        var maxNodes = TryGetIntArg(args, "--max-nodes", 80);
        var maxDepth = TryGetIntArg(args, "--max-depth", 3);
        var windowHandle = TryGetLongArg(args, "--window-handle");
        try
        {
            var root = windowHandle.HasValue
                ? AutomationElement.FromHandle((nint)windowHandle.Value)
                : AutomationElement.RootElement;
            var walker = TreeWalker.ControlViewWalker;
            var nodes = new List<object>();
            WalkUiTree(walker, root, nodes, 0, maxDepth, maxNodes);

            WriteJson(new
            {
                command = "ui.get_tree",
                observeOnly = true,
                capturedAt = DateTimeOffset.UtcNow.ToString("o"),
                windowHandle,
                maxDepth,
                maxNodes,
                nodes
            });
            return 0;
        }
        catch (Exception exception)
        {
            return Error(exception.ToString());
        }
    }

    private static void WalkUiTree(TreeWalker walker, AutomationElement element, List<object> nodes, int depth, int maxDepth, int maxNodes)
    {
        if (nodes.Count >= maxNodes || depth > maxDepth)
        {
            return;
        }

        var nodeId = $"node-{nodes.Count + 1}";
        nodes.Add(new
        {
            nodeId,
            depth,
            name = SafeRead(() => element.Current.Name),
            automationId = SafeRead(() => element.Current.AutomationId),
            className = SafeRead(() => element.Current.ClassName),
            controlType = SafeRead(() => element.Current.ControlType.ProgrammaticName),
            bounds = TryGetElementBounds(element)
        });

        if (depth == maxDepth)
        {
            return;
        }

        var child = walker.GetFirstChild(element);
        while (child is not null && nodes.Count < maxNodes)
        {
            WalkUiTree(walker, child, nodes, depth + 1, maxDepth, maxNodes);
            child = walker.GetNextSibling(child);
        }
    }

    private static int HighlightUiElement(string[] args)
    {
        var bounds = TryGetHighlightBounds(args);
        if (bounds is null)
        {
            return Error("ui.highlight requires --bounds <left> <top> <width> <height>.");
        }

        return CaptureScreen(args, "ui.highlight", bounds.Value);
    }

    private static int InvokeUiElement(string[] args)
    {
        if (!ValidateApprovalToken(args, out var error))
        {
            return Error(error);
        }

        var element = FindTargetElement(args);
        if (element is null)
        {
            return Error("ui.invoke requires a target element identified by --automation-id or --name.");
        }
        if (!element.TryGetCurrentPattern(InvokePattern.Pattern, out var pattern) || pattern is not InvokePattern invokePattern)
        {
            return Error("Target element does not support InvokePattern.");
        }

        invokePattern.Invoke();
        return ActiveOk("ui.invoke", "Invoked target UI element.");
    }

    private static int SetUiValue(string[] args)
    {
        if (!ValidateApprovalToken(args, out var error))
        {
            return Error(error);
        }

        var text = TryGetStringArg(args, "--text");
        if (text is null)
        {
            return Error("ui.set_value requires --text <value>.");
        }

        var element = FindTargetElement(args);
        if (element is null)
        {
            return Error("ui.set_value requires a target element identified by --automation-id or --name.");
        }
        if (!element.TryGetCurrentPattern(ValuePattern.Pattern, out var pattern) || pattern is not ValuePattern valuePattern)
        {
            return Error("Target element does not support ValuePattern.");
        }

        valuePattern.SetValue(text);
        return ActiveOk("ui.set_value", "Set target UI value.");
    }

    private static int SelectUiElement(string[] args)
    {
        if (!ValidateApprovalToken(args, out var error))
        {
            return Error(error);
        }

        var element = FindTargetElement(args);
        if (element is null)
        {
            return Error("ui.select requires a target element identified by --automation-id or --name.");
        }
        if (!element.TryGetCurrentPattern(SelectionItemPattern.Pattern, out var pattern) || pattern is not SelectionItemPattern selectionPattern)
        {
            return Error("Target element does not support SelectionItemPattern.");
        }

        selectionPattern.Select();
        return ActiveOk("ui.select", "Selected target UI element.");
    }

    private static int ToggleUiElement(string[] args)
    {
        if (!ValidateApprovalToken(args, out var error))
        {
            return Error(error);
        }

        var element = FindTargetElement(args);
        if (element is null)
        {
            return Error("ui.toggle requires a target element identified by --automation-id or --name.");
        }
        if (!element.TryGetCurrentPattern(TogglePattern.Pattern, out var pattern) || pattern is not TogglePattern togglePattern)
        {
            return Error("Target element does not support TogglePattern.");
        }

        togglePattern.Toggle();
        return ActiveOk("ui.toggle", "Toggled target UI element.");
    }

    private static int TypeKeyboardText(string[] args)
    {
        if (!ValidateApprovalToken(args, out var error))
        {
            return Error(error);
        }

        var text = TryGetStringArg(args, "--text");
        if (string.IsNullOrEmpty(text))
        {
            return Error("keyboard.type requires --text <text>.");
        }

        FocusWindowFromArgs(args);
        System.Windows.Forms.SendKeys.SendWait(EscapeSendKeysText(text));
        return ActiveOk("keyboard.type", "Typed approved text.");
    }

    private static int SendKeyboardChord(string[] args)
    {
        if (!ValidateApprovalToken(args, out var error))
        {
            return Error(error);
        }

        var chord = TryGetStringArg(args, "--chord");
        if (string.IsNullOrWhiteSpace(chord) || !AllowedChords.TryGetValue(chord, out var sendKeysChord))
        {
            return Error("keyboard.chord requires an allowed --chord value.");
        }

        FocusWindowFromArgs(args);
        System.Windows.Forms.SendKeys.SendWait(sendKeysChord);
        return ActiveOk("keyboard.chord", $"Sent approved keyboard chord {chord}.");
    }

    private static int ClickMouse(string[] args)
    {
        if (!ValidateApprovalToken(args, out var error))
        {
            return Error(error);
        }

        var bounds = TryGetHighlightBounds(args);
        if (bounds is null)
        {
            return Error("mouse.click requires --bounds <left> <top> <width> <height>.");
        }

        FocusWindowFromArgs(args);
        var x = bounds.Value.Left + bounds.Value.Width / 2;
        var y = bounds.Value.Top + bounds.Value.Height / 2;
        if (!SetCursorPos(x, y))
        {
            return Error("SetCursorPos failed.");
        }

        mouse_event(MouseEventLeftDown, 0, 0, 0, UIntPtr.Zero);
        mouse_event(MouseEventLeftUp, 0, 0, 0, UIntPtr.Zero);
        return ActiveOk("mouse.click", "Clicked the approved target bounds.");
    }

    private static int EmergencyStop()
    {
        return ActiveOk("emergency.stop", "Emergency stop acknowledged.");
    }

    private static bool ValidateApprovalToken(string[] args, out string error)
    {
        var supplied = TryGetStringArg(args, "--approval-token");
        var expected = Environment.GetEnvironmentVariable("HERMES_BROKER_APPROVAL_TOKEN");
        if (string.IsNullOrWhiteSpace(supplied) ||
            string.IsNullOrWhiteSpace(expected) ||
            expected.Length < 16 ||
            !string.Equals(supplied, expected, StringComparison.Ordinal))
        {
            error = "Active commands require a matching ephemeral approval token.";
            return false;
        }

        error = string.Empty;
        return true;
    }

    private static AutomationElement? FindTargetElement(string[] args)
    {
        try
        {
            var windowHandle = TryGetLongArg(args, "--window-handle");
            var root = windowHandle.HasValue
                ? AutomationElement.FromHandle((nint)windowHandle.Value)
                : AutomationElement.RootElement;
            var automationId = TryGetStringArg(args, "--automation-id");
            var name = TryGetStringArg(args, "--name");
            if (string.IsNullOrWhiteSpace(automationId) && string.IsNullOrWhiteSpace(name))
            {
                return root;
            }

            return FindDescendant(root, automationId, name);
        }
        catch
        {
            return null;
        }
    }

    private static AutomationElement? FindDescendant(AutomationElement root, string? automationId, string? name)
    {
        var queue = new Queue<AutomationElement>();
        queue.Enqueue(root);
        var walker = TreeWalker.ControlViewWalker;
        var visited = 0;

        while (queue.Count > 0 && visited < 600)
        {
            var element = queue.Dequeue();
            visited += 1;
            if (MatchesTarget(element, automationId, name))
            {
                return element;
            }

            AutomationElement? child = null;
            try
            {
                child = walker.GetFirstChild(element);
            }
            catch
            {
                child = null;
            }

            while (child is not null && visited + queue.Count < 600)
            {
                queue.Enqueue(child);
                try
                {
                    child = walker.GetNextSibling(child);
                }
                catch
                {
                    child = null;
                }
            }
        }

        return null;
    }

    private static bool MatchesTarget(AutomationElement element, string? automationId, string? name)
    {
        var currentAutomationId = SafeRead(() => element.Current.AutomationId);
        var currentName = SafeRead(() => element.Current.Name);
        return (!string.IsNullOrWhiteSpace(automationId) && string.Equals(currentAutomationId, automationId, StringComparison.Ordinal)) ||
            (!string.IsNullOrWhiteSpace(name) && string.Equals(currentName, name, StringComparison.Ordinal));
    }

    private static void FocusWindowFromArgs(string[] args)
    {
        var windowHandle = TryGetLongArg(args, "--window-handle");
        if (windowHandle.HasValue)
        {
            _ = SetForegroundWindow((nint)windowHandle.Value);
            Thread.Sleep(75);
        }
    }

    private static string EscapeSendKeysText(string text)
    {
        var builder = new StringBuilder();
        foreach (var character in text)
        {
            switch (character)
            {
                case '+':
                case '^':
                case '%':
                case '~':
                case '(':
                case ')':
                case '{':
                case '}':
                case '[':
                case ']':
                    builder.Append('{').Append(character).Append('}');
                    break;
                case '\r':
                    break;
                case '\n':
                    builder.Append("{ENTER}");
                    break;
                default:
                    builder.Append(character);
                    break;
            }
        }

        return builder.ToString();
    }

    private static int ActiveOk(string command, string detail)
    {
        WriteJson(new
        {
            ok = true,
            command,
            active = true,
            executedAt = DateTimeOffset.UtcNow.ToString("o"),
            detail
        });
        return 0;
    }

    private static int CaptureScreen(string[] args, string command, HighlightBounds? highlightBounds)
    {
        var outputPath = TryGetStringArg(args, "--output");
        if (string.IsNullOrWhiteSpace(outputPath))
        {
            return Error($"{command} requires --output <png-path>.");
        }
        if (!Path.GetExtension(outputPath).Equals(".png", StringComparison.OrdinalIgnoreCase))
        {
            return Error($"{command} output must be a PNG file.");
        }

        try
        {
            var fullOutputPath = Path.GetFullPath(outputPath);
            Directory.CreateDirectory(Path.GetDirectoryName(fullOutputPath) ?? ".");
            var virtualBounds = GetVirtualScreenBounds();
            using var bitmap = new Bitmap(virtualBounds.Width, virtualBounds.Height, PixelFormat.Format32bppArgb);
            using (var graphics = Graphics.FromImage(bitmap))
            {
                graphics.CopyFromScreen(new Point(virtualBounds.Left, virtualBounds.Top), Point.Empty, virtualBounds.Size);
                if (highlightBounds.HasValue)
                {
                    var adjusted = new Rectangle(
                        highlightBounds.Value.Left - virtualBounds.Left,
                        highlightBounds.Value.Top - virtualBounds.Top,
                        highlightBounds.Value.Width,
                        highlightBounds.Value.Height);
                    using var pen = new Pen(Color.FromArgb(230, 216, 59, 1), 4);
                    graphics.DrawRectangle(pen, adjusted);
                }
            }

            bitmap.Save(fullOutputPath, ImageFormat.Png);
            WriteJson(new
            {
                command,
                observeOnly = true,
                capturedAt = DateTimeOffset.UtcNow.ToString("o"),
                filePath = fullOutputPath,
                width = bitmap.Width,
                height = bitmap.Height,
                highlightBounds = highlightBounds.HasValue ? new
                {
                    left = highlightBounds.Value.Left,
                    top = highlightBounds.Value.Top,
                    width = highlightBounds.Value.Width,
                    height = highlightBounds.Value.Height
                } : null
            });
            return 0;
        }
        catch (Exception exception)
        {
            return Error(exception.ToString());
        }
    }

    private static string? SafeRead(Func<string?> read)
    {
        try
        {
            return read();
        }
        catch
        {
            return null;
        }
    }

    private static object? TryGetElementBounds(AutomationElement element)
    {
        try
        {
            return ToBounds(element.Current.BoundingRectangle);
        }
        catch
        {
            return null;
        }
    }

    private static object? TryGetWindowBounds(nint handle)
    {
        return GetWindowRect(handle, out var rect)
            ? new
            {
                left = rect.Left,
                top = rect.Top,
                width = rect.Right - rect.Left,
                height = rect.Bottom - rect.Top
            }
            : null;
    }

    private static object? ToBounds(System.Windows.Rect rect)
    {
        if (rect.IsEmpty ||
            double.IsNaN(rect.Left) ||
            double.IsNaN(rect.Top) ||
            double.IsNaN(rect.Width) ||
            double.IsNaN(rect.Height) ||
            double.IsInfinity(rect.Left) ||
            double.IsInfinity(rect.Top) ||
            rect.Width <= 0 ||
            rect.Height <= 0)
        {
            return null;
        }

        return new
        {
            left = (int)Math.Round(rect.Left),
            top = (int)Math.Round(rect.Top),
            width = (int)Math.Round(rect.Width),
            height = (int)Math.Round(rect.Height)
        };
    }

    private static Rectangle GetVirtualScreenBounds()
    {
        var screens = System.Windows.Forms.Screen.AllScreens;
        if (screens.Length == 0)
        {
            return System.Windows.Forms.Screen.PrimaryScreen?.Bounds ?? new Rectangle(0, 0, 1, 1);
        }

        var bounds = screens[0].Bounds;
        foreach (var screen in screens.Skip(1))
        {
            bounds = Rectangle.Union(bounds, screen.Bounds);
        }

        return bounds;
    }

    private static int TryGetIntArg(string[] args, string name, int fallback)
    {
        var index = Array.IndexOf(args, name);
        if (index < 0 || index + 1 >= args.Length)
        {
            return fallback;
        }

        return int.TryParse(args[index + 1], out var value) ? value : fallback;
    }

    private static long? TryGetLongArg(string[] args, string name)
    {
        var index = Array.IndexOf(args, name);
        if (index < 0 || index + 1 >= args.Length)
        {
            return null;
        }

        return long.TryParse(args[index + 1], out var value) ? value : null;
    }

    private static string? TryGetStringArg(string[] args, string name)
    {
        var index = Array.IndexOf(args, name);
        if (index < 0 || index + 1 >= args.Length)
        {
            return null;
        }

        return args[index + 1];
    }

    private static HighlightBounds? TryGetHighlightBounds(string[] args)
    {
        var index = Array.IndexOf(args, "--bounds");
        if (index < 0 || index + 4 >= args.Length)
        {
            return null;
        }
        if (!int.TryParse(args[index + 1], out var left) ||
            !int.TryParse(args[index + 2], out var top) ||
            !int.TryParse(args[index + 3], out var width) ||
            !int.TryParse(args[index + 4], out var height) ||
            width <= 0 ||
            height <= 0)
        {
            return null;
        }

        return new HighlightBounds(left, top, width, height);
    }

    private static int Error(string message)
    {
        WriteJson(new
        {
            ok = false,
            error = message
        });
        return 1;
    }

    private static void WriteJson(object value)
    {
        Console.WriteLine(JsonSerializer.Serialize(value, new JsonSerializerOptions
        {
            WriteIndented = true
        }));
    }

    private static string GetWindowText(nint handle)
    {
        var length = GetWindowTextLength(handle);
        var builder = new StringBuilder(length + 1);
        _ = GetWindowText(handle, builder, builder.Capacity);
        return builder.ToString();
    }

    private static string GetClassName(nint handle)
    {
        var builder = new StringBuilder(256);
        _ = GetClassName(handle, builder, builder.Capacity);
        return builder.ToString();
    }

    private delegate bool EnumWindowsDelegate(nint handle, nint parameter);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool EnumWindows(EnumWindowsDelegate callback, nint parameter);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool IsWindowVisible(nint handle);

    [DllImport("user32.dll", EntryPoint = "GetWindowTextLengthW", CharSet = CharSet.Unicode)]
    private static extern int GetWindowTextLength(nint handle);

    [DllImport("user32.dll", EntryPoint = "GetWindowTextW", CharSet = CharSet.Unicode)]
    private static extern int GetWindowText(nint handle, StringBuilder text, int maxCount);

    [DllImport("user32.dll", EntryPoint = "GetClassNameW", CharSet = CharSet.Unicode)]
    private static extern int GetClassName(nint handle, StringBuilder className, int maxCount);

    [DllImport("user32.dll")]
    private static extern uint GetWindowThreadProcessId(nint handle, out int processId);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool GetWindowRect(nint handle, out NativeRect rect);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool SetForegroundWindow(nint handle);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool SetCursorPos(int x, int y);

    [DllImport("user32.dll")]
    private static extern void mouse_event(uint flags, uint dx, uint dy, uint data, UIntPtr extraInfo);

    [StructLayout(LayoutKind.Sequential)]
    private readonly struct NativeRect
    {
        public readonly int Left;
        public readonly int Top;
        public readonly int Right;
        public readonly int Bottom;
    }

    private readonly record struct HighlightBounds(int Left, int Top, int Width, int Height);
}

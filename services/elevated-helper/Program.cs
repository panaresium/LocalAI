using System.Diagnostics;
using System.Security.Principal;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace HermesLocalAI.ElevatedHelper;

internal static class Program
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        WriteIndented = false,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };

    public static int Main(string[] args)
    {
        try
        {
            string command = args.Length > 0 ? args[0] : "help";
            return command switch
            {
                "probe" => WriteProbe(),
                "session.accept" => AcceptSession(args.Skip(1).ToArray()),
                "help" or "--help" or "-h" => WriteHelp(),
                _ => WriteError($"Unsupported elevated helper command: {command}.")
            };
        }
        catch (Exception ex)
        {
            return WriteError(ex.Message);
        }
    }

    private static int WriteProbe()
    {
        var response = new
        {
            command = "helper.probe",
            helper = "HermesLocalAI.ElevatedHelper",
            elevated = IsElevated(),
            processId = Environment.ProcessId,
            startedAt = DateTimeOffset.UtcNow.ToString("O"),
            manualUacStartupOnly = true,
            silentElevationAllowed = false,
            secureDesktopAutomationAllowed = false,
            supportedCommands = new[] { "helper.probe", "session.accept" }
        };
        Console.WriteLine(JsonSerializer.Serialize(response, JsonOptions));
        return 0;
    }

    private static int AcceptSession(string[] args)
    {
        string sessionId = RequiredArg(args, "--session-id");
        string approvalCode = RequiredArg(args, "--approval-code");
        string expiresAtText = RequiredArg(args, "--expires-at");
        string? auditOutput = OptionalArg(args, "--audit-output");

        if (!DateTimeOffset.TryParse(expiresAtText, out DateTimeOffset expiresAt))
        {
            return WriteError("Invalid elevated helper session expiry.");
        }

        bool elevated = IsElevated();
        string status = elevated && DateTimeOffset.UtcNow <= expiresAt ? "accepted" : "rejected";
        var response = new
        {
            command = "session.accept",
            sessionId,
            approvalCodeLength = approvalCode.Length,
            status,
            elevated,
            processId = Environment.ProcessId,
            acceptedAt = DateTimeOffset.UtcNow.ToString("O"),
            expiresAt = expiresAt.ToString("O"),
            secureDesktopAutomationAllowed = false,
            silentElevationAllowed = false
        };

        if (!string.IsNullOrWhiteSpace(auditOutput))
        {
            string directory = Path.GetDirectoryName(Path.GetFullPath(auditOutput)) ?? Directory.GetCurrentDirectory();
            Directory.CreateDirectory(directory);
            File.WriteAllText(auditOutput, JsonSerializer.Serialize(response, JsonOptions));
        }

        Console.WriteLine(JsonSerializer.Serialize(response, JsonOptions));
        return status == "accepted" ? 0 : 2;
    }

    private static int WriteHelp()
    {
        var response = new
        {
            command = "helper.help",
            commands = new[] { "probe", "session.accept" },
            note = "Start this helper manually with UAC when Studio asks. It does not automate UAC or secure desktop."
        };
        Console.WriteLine(JsonSerializer.Serialize(response, JsonOptions));
        return 0;
    }

    private static bool IsElevated()
    {
        using WindowsIdentity identity = WindowsIdentity.GetCurrent();
        WindowsPrincipal principal = new(identity);
        return principal.IsInRole(WindowsBuiltInRole.Administrator);
    }

    private static string RequiredArg(string[] args, string name)
    {
        string? value = OptionalArg(args, name);
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new ArgumentException($"Missing required argument {name}.");
        }
        return value;
    }

    private static string? OptionalArg(string[] args, string name)
    {
        for (int index = 0; index < args.Length - 1; index += 1)
        {
            if (string.Equals(args[index], name, StringComparison.OrdinalIgnoreCase))
            {
                return args[index + 1];
            }
        }
        return null;
    }

    private static int WriteError(string message)
    {
        var response = new
        {
            command = "helper.error",
            ok = false,
            error = message
        };
        Console.Error.WriteLine(JsonSerializer.Serialize(response, JsonOptions));
        return 1;
    }
}

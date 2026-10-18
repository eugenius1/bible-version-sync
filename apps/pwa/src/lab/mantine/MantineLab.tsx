import "@mantine/core/styles.css";
import { BOOKS } from "@bvs/core";
import {
  ActionIcon,
  Alert,
  Anchor,
  Autocomplete,
  Badge,
  Button,
  Card,
  ColorSwatch,
  Container,
  createTheme,
  Divider,
  Group,
  Image,
  List,
  MantineProvider,
  NumberInput,
  Paper,
  Progress,
  SegmentedControl,
  Select,
  Stack,
  Switch,
  Text,
  ThemeIcon,
  Title,
  Tooltip,
  UnstyledButton,
  type MantineColor,
} from "@mantine/core";
import {
  ArrowDown,
  ArrowUp,
  BadgeCheck,
  Ban,
  Check,
  CircleAlert,
  Eye,
  Hash,
  Info,
  LogIn,
  LogOut,
  RefreshCw,
  RotateCcw,
  Search,
  Sparkles,
  Square,
  X,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { useI18n } from "../../i18n";
import { copyrightYears } from "../../lib/copyright";
import type { ResolvedVersion } from "../../lib/versions";
import { useDark } from "../Lab";
import { labHref, type Page } from "../route";
import { COLOR_HEX, SAMPLE_CHANGES, swap, useSampleMain, type Kind } from "../sample";

// The app's palette, so the comparison is about components rather than colours:
// stone for neutrals (Mantine's "dark" scale drives dark mode) and amber as the accent.
const theme = createTheme({
  primaryColor: "amber",
  primaryShade: { light: 7, dark: 5 },
  defaultRadius: "md",
  fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  headings: { fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' },
  colors: {
    amber: ["#fffbeb", "#fef3c7", "#fde68a", "#fcd34d", "#fbbf24", "#f59e0b", "#d97706", "#b45309", "#92400e", "#78350f"],
    dark: ["#f5f5f4", "#e7e5e4", "#d6d3d1", "#a8a29e", "#78716c", "#57534e", "#44403c", "#292524", "#1c1917", "#0c0a09"],
  },
});

const SOURCE: Record<ResolvedVersion["source"], { color: MantineColor; Icon: typeof BadgeCheck }> = {
  verified: { color: "teal", Icon: BadgeCheck },
  scanned: { color: "blue", Icon: Hash },
  "api-index": { color: "blue", Icon: Info },
  assumed: { color: "yellow", Icon: CircleAlert },
  unsupported: { color: "red", Icon: Ban },
};

export default function MantineLab({ page }: { page: Page }) {
  const dark = useDark();
  return (
    <MantineProvider theme={theme} forceColorScheme={dark ? "dark" : "light"}>
      {page === "login" ? <SignIn /> : <Main />}
    </MantineProvider>
  );
}

function Shell({ children, account }: { children: ReactNode; account?: ReactNode }) {
  const { t, f } = useI18n();
  return (
    <Container size={672} py="xl">
      <Stack gap="md">
        <Group gap="sm">
          <Image src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" w={36} h={36} />
          <Title order={1} size="h3">
            Bible Version Sync
          </Title>
          <Badge variant="light" color="gray" ml="auto">
            Mantine
          </Badge>
        </Group>
        {children}
        <Divider mt="lg" />
        {account && <Group gap="xs">{account}</Group>}
        <Text size="xs" c="dimmed" ta="center">
          {f(t.app.copyright, { years: copyrightYears() })} · <Anchor size="xs" inherit>{t.app.licence}</Anchor> ·{" "}
          {t.app.notAffiliated}
        </Text>
      </Stack>
    </Container>
  );
}

function SignIn() {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  return (
    <Shell>
      <Paper withBorder shadow="sm" p="xl" radius="lg">
        <Stack gap="lg">
          <Text size="lg">{t.signIn.intro}</Text>
          <List
            spacing="sm"
            size="sm"
            c="dimmed"
            icon={
              <ThemeIcon size={22} radius="xl" variant="light">
                <Check size={14} />
              </ThemeIcon>
            }
          >
            {t.signIn.points.map((p) => (
              <List.Item key={p}>{p}</List.Item>
            ))}
          </List>
          <Button
            size="md"
            leftSection={<LogIn size={18} />}
            loading={busy}
            loaderProps={{ type: "dots" }}
            onClick={() => {
              // Pretend: the lab never signs in, it just moves on to the main page.
              setBusy(true);
              setTimeout(() => (location.hash = labHref("mantine", "main")), 700);
            }}
            style={{ alignSelf: "flex-start" }}
          >
            {t.signIn.button}
          </Button>
        </Stack>
      </Paper>
      <Text size="xs" c="dimmed" px={4}>
        {t.signIn.disclaimer}
      </Text>
    </Shell>
  );
}

function StepTitle({ n, children }: { n: number; children: ReactNode }) {
  return (
    <Group gap="xs" wrap="nowrap">
      <ThemeIcon size={24} radius="xl" color="dark" variant="filled" fw={700} fz="xs">
        {n}
      </ThemeIcon>
      <Title order={2} size="h5">
        {children}
      </Title>
    </Group>
  );
}

function Main() {
  const { t, f, plural, num, book: bookName } = useI18n();
  const s = useSampleMain();
  const [remembered, setRemembered] = useState(1284);
  const running = s.run.status === "running";
  const tv = t.versions;
  const tp = t.priority;
  const ts = t.sync;

  const account = (
    <>
      <Text size="xs" c="dimmed">
        {plural(t.footer.memory, remembered)}
      </Text>
      <Button variant="subtle" color="gray" size="compact-xs" leftSection={<RotateCcw size={12} />} onClick={() => setRemembered(0)}>
        {t.footer.reset}
      </Button>
      <Button
        variant="subtle"
        color="gray"
        size="compact-xs"
        leftSection={<LogOut size={12} />}
        component="a"
        href={labHref("mantine", "login")}
        ml="auto"
      >
        {t.footer.signOut}
      </Button>
    </>
  );

  return (
    <Shell account={account}>
      {/* 1. Versions */}
      <Card withBorder shadow="sm" radius="lg" padding="lg">
        <Stack gap="md">
          <div>
            <StepTitle n={1}>{tv.title}</StepTitle>
            <Text size="sm" c="dimmed" mt={4}>
              {tv.help}
            </Text>
          </div>
          <Stack gap={0}>
            {s.versions.map((v, i) => {
              const src = tv.source[v.source];
              const { color, Icon } = SOURCE[v.source];
              return (
                <div key={v.bibleId}>
                  {i > 0 && <Divider />}
                  <Group py="sm" wrap="nowrap" align="flex-start">
                    <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
                      <Group gap="xs" wrap="nowrap">
                        <Text fw={600}>{v.abbr}</Text>
                        <Text size="sm" c="dimmed" truncate lang={v.language} dir="auto">
                          {v.title}
                        </Text>
                      </Group>
                      <Tooltip label={f(src.hint, { system: tv.systems.eng, n: num(23) })} multiline w={280} withArrow>
                        <Badge
                          variant="light"
                          color={color}
                          leftSection={<Icon size={12} />}
                          tt="none"
                          fw={500}
                          style={{ alignSelf: "flex-start" }}
                        >
                          {src.text}
                        </Badge>
                      </Tooltip>
                    </Stack>
                    <Tooltip label={f(tv.remove, { abbr: v.abbr })}>
                      <ActionIcon
                        variant="subtle"
                        color="gray"
                        size="lg"
                        disabled={running || s.versions.length <= 2}
                        aria-label={f(tv.remove, { abbr: v.abbr })}
                        onClick={() => s.setVersions(s.versions.filter((x) => x.bibleId !== v.bibleId))}
                      >
                        <X size={16} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </div>
              );
            })}
          </Stack>
          <Alert variant="light" color="amber" icon={<Sparkles size={18} />} title={tv.find.button}>
            <Text size="sm">{tv.find.help}</Text>
            <Button size="xs" variant="white" color="dark" mt="sm">
              {tv.find.button}
            </Button>
          </Alert>
          <Autocomplete
            label={tv.addLabel}
            placeholder={tv.addPlaceholder}
            leftSection={<Search size={16} />}
            data={["ESV — English Standard Version", "NLT — New Living Translation", "NKJV — New King James Version", "S21 — Segond 21"]}
            description={`${tv.addHelp} bible.com/bible/59`}
          />
        </Stack>
      </Card>

      {/* 2. Priority */}
      <Card withBorder shadow="sm" radius="lg" padding="lg">
        <Stack gap="md">
          <div>
            <StepTitle n={2}>{tp.title}</StepTitle>
            <Text size="sm" c="dimmed" mt={4}>
              {s.byColor ? tp.helpByColor : tp.helpByVersion}
            </Text>
          </div>
          <Group justify="center" gap="sm">
            <UnstyledButton onClick={() => s.setByColor(false)} fw={500} fz="sm" c={s.byColor ? "dimmed" : undefined}>
              {tp.byVersion}
            </UnstyledButton>
            <Switch
              size="md"
              aria-label={tp.toggle}
              checked={s.byColor}
              onChange={(e) => s.setByColor(e.currentTarget.checked)}
              disabled={running}
              // Both sides are a choice, so the track stays coloured either way.
              styles={{ track: { backgroundColor: "var(--mantine-primary-color-filled)", borderColor: "transparent" } }}
            />
            <UnstyledButton onClick={() => s.setByColor(true)} fw={500} fz="sm" c={s.byColor ? undefined : "dimmed"}>
              {tp.byColor}
            </UnstyledButton>
          </Group>
          <Stack gap={0}>
            {s.byColor
              ? s.colorOrder.map((id, i) => (
                  <ReorderRow
                    key={id}
                    n={i + 1}
                    count={s.colorOrder.length}
                    up={f(tp.moveUp, { color: tp.names[id] })}
                    down={f(tp.moveDown, { color: tp.names[id] })}
                    disabled={running}
                    onMove={(d) => s.setColorOrder(swap(s.colorOrder, i, d))}
                  >
                    <ColorSwatch color={COLOR_HEX[id]} size={22} />
                    <Text size="sm">{tp.names[id]}</Text>
                  </ReorderRow>
                ))
              : s.versions.map((v, i) => (
                  <ReorderRow
                    key={v.bibleId}
                    n={i + 1}
                    count={s.versions.length}
                    up={f(tv.moveUp, { abbr: v.abbr })}
                    down={f(tv.moveDown, { abbr: v.abbr })}
                    disabled={running}
                    onMove={(d) => s.setVersions(swap(s.versions, i, d))}
                  >
                    <Text fw={600}>{v.abbr}</Text>
                    <Text size="sm" c="dimmed" truncate lang={v.language} dir="auto">
                      {v.title}
                    </Text>
                  </ReorderRow>
                ))}
          </Stack>
          {s.byColor && (
            <Text size="xs" c="dimmed">
              {tp.note}
            </Text>
          )}
        </Stack>
      </Card>

      {/* 3. Sync */}
      <Card withBorder shadow="sm" radius="lg" padding="lg">
        <Stack gap="md">
          <StepTitle n={3}>{ts.title}</StepTitle>
          <SegmentedControl
            fullWidth
            disabled={running}
            value={s.kind}
            onChange={(k) => s.setKind(k as Kind)}
            data={(["chapter", "book", "bible"] as const).map((k) => ({ value: k, label: ts[k] }))}
          />
          {s.kind !== "bible" && (
            <Group gap="sm" wrap="nowrap">
              <Select
                aria-label={ts.book}
                searchable
                disabled={running}
                style={{ flex: 1 }}
                value={s.book}
                onChange={(b) => b && s.setBook(b)}
                data={BOOKS.map((b) => ({ value: b, label: bookName(b) }))}
                allowDeselect={false}
              />
              {s.kind === "chapter" && (
                <NumberInput
                  aria-label={ts.chapter}
                  w={100}
                  min={1}
                  max={21}
                  disabled={running}
                  value={s.chapter}
                  onChange={(c) => s.setChapter(Number(c))}
                />
              )}
            </Group>
          )}
          {s.kind === "bible" && (
            <Text size="sm" c="dimmed">
              {f(ts.bibleNote, { n: num(1189 * 4) })}
            </Text>
          )}
          {s.run.status === "running" ? (
            <Stack gap="xs">
              <Group justify="space-between" wrap="nowrap">
                <Group gap="xs" wrap="nowrap">
                  <RefreshCw size={14} className="animate-spin motion-reduce:animate-none" />
                  <Text size="sm">
                    {s.run.apply ? ts.syncing : ts.previewing} —{" "}
                    {f(ts.reading, { book: bookName(s.book), done: num(Math.round(s.run.pct / 5)), total: num(21) })}
                  </Text>
                </Group>
                <Button variant="subtle" color="gray" size="xs" leftSection={<Square size={14} />} onClick={s.stop}>
                  {ts.stop}
                </Button>
              </Group>
              <Progress value={s.run.pct} animated />
            </Stack>
          ) : (
            <Group gap="sm">
              <Button leftSection={<Eye size={16} />} color="dark" onClick={() => s.start(false)}>
                {ts.preview}
              </Button>
              <Button leftSection={<RefreshCw size={16} />} variant="default" onClick={() => s.start(true)}>
                {ts.syncNow}
              </Button>
            </Group>
          )}
        </Stack>
      </Card>

      {s.run.status === "done" && (
        <Card withBorder shadow="sm" radius="lg" padding="lg">
          <Stack gap="md">
            <Group justify="space-between">
              <Title order={2} size="h5">
                {s.run.apply ? t.results.doneTitle : t.results.previewTitle}
              </Title>
              <Badge variant="light" size="lg" tt="none" fw={500}>
                {plural(s.run.apply ? t.results.added : t.results.toAdd, 13)}
              </Badge>
            </Group>
            <Stack gap="xs">
              {SAMPLE_CHANGES.map((c) => (
                <Group key={c.ref} gap="sm" wrap="nowrap">
                  <ColorSwatch color={COLOR_HEX[c.color]} size={16} />
                  <Text size="sm" fw={500} w={80}>
                    {c.ref}
                  </Text>
                  <Text size="sm" c="dimmed">
                    {c.from} → {c.to.join(", ")}
                  </Text>
                </Group>
              ))}
            </Stack>
            {!s.run.apply && (
              <Group gap="sm">
                <Button onClick={() => s.start(true)}>{plural(t.results.apply, 13)}</Button>
                <Button variant="default" onClick={s.reset}>
                  {t.app.back}
                </Button>
              </Group>
            )}
          </Stack>
        </Card>
      )}
    </Shell>
  );
}

function ReorderRow(p: {
  n: number;
  count: number;
  up: string;
  down: string;
  disabled: boolean;
  onMove: (d: -1 | 1) => void;
  children: ReactNode;
}) {
  return (
    <>
      {p.n > 1 && <Divider />}
      <Group py={6} wrap="nowrap" gap="sm">
        <Text size="sm" c="dimmed" w={20} ta="right" style={{ fontVariantNumeric: "tabular-nums" }}>
          {p.n}
        </Text>
        <Group gap="sm" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
          {p.children}
        </Group>
        <ActionIcon.Group>
          <ActionIcon variant="subtle" color="gray" size="lg" aria-label={p.up} disabled={p.disabled || p.n === 1} onClick={() => p.onMove(-1)}>
            <ArrowUp size={16} />
          </ActionIcon>
          <ActionIcon
            variant="subtle"
            color="gray"
            size="lg"
            aria-label={p.down}
            disabled={p.disabled || p.n === p.count}
            onClick={() => p.onMove(1)}
          >
            <ArrowDown size={16} />
          </ActionIcon>
        </ActionIcon.Group>
      </Group>
    </>
  );
}

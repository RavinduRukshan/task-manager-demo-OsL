import ThemeRegistry from '../components/ThemeRegistry';

export const metadata = {
  title: 'Task Manager',
  description: 'Full-stack Task Management Application',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" style={{ height: '100%', overflow: 'hidden' }}>
      <body style={{ margin: 0, height: '100%', overflow: 'hidden' }}>
        <ThemeRegistry>{children}</ThemeRegistry>
      </body>
    </html>
  );
}

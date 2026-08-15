import { createFileRoute } from '@tanstack/react-router';
import Layout from '../components/Layout';
import Lists from '../pages/Lists';

export const Route = createFileRoute('/lists')({
  component: () => <Layout><Lists /></Layout>,
});

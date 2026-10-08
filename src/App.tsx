import { MotionConfig } from 'framer-motion';
import { RouterProvider } from 'react-router-dom';
import { router } from './router';

/** Root component. MotionConfig makes framer-motion honour prefers-reduced-motion everywhere. */
export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <RouterProvider router={router} future={{ v7_startTransition: true }} />
    </MotionConfig>
  );
}

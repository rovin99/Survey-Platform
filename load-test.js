import http from 'k6/http';
import { sleep } from 'k6';

export const options = {
  vus: 200,
  duration: '2m',
};

export default function () {
  http.get('http://localhost:3000/api/auth/verify');
  sleep(1);
}

import axios from "axios";

const api = axios.create({
	baseURL: "/",
	withCredentials: true, // send session cookie on every request
});

api.interceptors.response.use(
	(res) => res,
	(err) => {
		if (err.response?.status === 401 && !window.location.pathname.startsWith("/login")) {
			window.location.href = "/login";
		}
		return Promise.reject(err);
	},
);

export default api;

package io.breachers.config;

import io.breachers.persistence.MatchPersistenceService;
import io.breachers.servlet.MatchReportServlet;
import org.springframework.boot.web.servlet.ServletRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * AcademicServletConfig
 * Explicitly registers MatchReportServlet into the embedded Servlet container
 * at the endpoint mapping `/academic/match-report`.
 */
@Configuration
public class AcademicServletConfig {

    @Bean
    public ServletRegistrationBean<MatchReportServlet> matchReportServletRegistration(MatchPersistenceService persistenceService) {
        MatchReportServlet servlet = new MatchReportServlet(persistenceService);
        ServletRegistrationBean<MatchReportServlet> registration = new ServletRegistrationBean<>(
                servlet,
                "/academic/match-report"
        );
        registration.setName("MatchReportServlet");
        registration.setLoadOnStartup(1);
        return registration;
    }
}
